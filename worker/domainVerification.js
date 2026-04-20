import createPrisma from '@/lib/create-prisma'
import {
  verifyDNSRecord,
  issueDomainCertificate,
  checkCertificateStatus,
  certDetails,
  extractCertificateStatus,
  getValidationValues,
  attachDomainCertificate,
  deleteDomainCertificate,
  detachDomainCertificate,
  ACM_TERMINAL_FAILED_STATUSES
} from '@/lib/domain-verification'
import {
  DOMAIN_HOLD_RETENTION_DAYS,
  DOMAIN_VERIFICATION_HOLD_AFTER_DAYS,
  DOMAIN_VERIFICATION_INTERVAL_SECONDS,
  DOMAIN_VERIFICATION_RETRY_DELAY_SECONDS,
  DOMAIN_VERIFICATION_RETRY_LIMIT,
  DOMAIN_VERIFICATION_SLOW_AFTER_HOURS,
  DOMAIN_VERIFICATION_SLOW_INTERVAL_SECONDS
} from '@/lib/constants'
import { cleanDomainVerificationJobs } from '@/api/resolvers/domain'
import { datePivot } from '@/lib/time'

const getVerificationInterval = (updatedAt) => {
  const pivot = datePivot(new Date(), { hours: -DOMAIN_VERIFICATION_SLOW_AFTER_HOURS })
  if (pivot > updatedAt) return DOMAIN_VERIFICATION_SLOW_INTERVAL_SECONDS
  return DOMAIN_VERIFICATION_INTERVAL_SECONDS
}

export async function domainVerification ({ id: jobId, data: { domainId }, boss }) {
  // establish connection to database
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })
  try {
    // get domain from database
    const domain = await models.domain.findUnique({
      where: { id: domainId },
      include: {
        records: true,
        certificate: true
      }
    })

    // if we can't find the domain, bail without scheduling a retry
    if (!domain) {
      console.log(`domain with ID ${domainId} not found`)
      return
    }

    console.log(`domainVerification: ${JSON.stringify({
      id: domain.id,
      domainName: domain.domainName,
      subName: domain.subName,
      status: domain.status,
      recordCount: domain.records?.length ?? 0,
      certificateStatus: domain.certificate?.status ?? null,
      updatedAt: domain.updatedAt
    })}`)

    // when a domain gets put on HOLD, we delete any remaining domain verification jobs
    // this handles the edge case where a domain is put on HOLD manually or for some other reason
    if (domain.status === 'HOLD') {
      console.log(`domain ${domain.domainName} is on HOLD, skipping verification and deleting any remaining domain verification jobs`)
      await cleanDomainVerificationJobs(domainId, models)
      return
    }

    // start verification process
    const result = await verifyDomain(domain, models)
    console.log(`domain verification result: ${JSON.stringify(result)}`)

    const domainStatus = result.status === 'VERIFIED'
      ? 'ACTIVE'
      : result.status === 'FAILED' ? 'HOLD' : 'PENDING'

    // update the domain status only if it has changed
    if (domain.status !== domainStatus) {
      await models.domain.update({
        where: { id: domainId },
        data: { status: domainStatus }
      })
    }

    // log the overall verification attempt
    await logAttempt({ domain, models, stage: 'VERIFICATION_COMPLETE', status: result.status, message: result.message })

    // if the result is PENDING it means we still have to verify the domain
    // if it's not PENDING, we stop the verification process.
    if (result.status === 'PENDING') {
      // we still need to verify the domain, schedule the job to run again
      const newJobId = await boss.sendDebounced('domainVerification', { domainId }, {
        startAfter: getVerificationInterval(domain.updatedAt),
        retryLimit: DOMAIN_VERIFICATION_RETRY_LIMIT,
        retryDelay: DOMAIN_VERIFICATION_RETRY_DELAY_SECONDS
      }, DOMAIN_VERIFICATION_INTERVAL_SECONDS, `domainVerification:${domainId}`)
      console.log(`domain ${domain.domainName} is still pending verification, created job with ID ${newJobId}`)
    }
  } catch (error) {
    console.error(`couldn't verify domain with ID ${domainId}: ${error.message}`)

    try {
      // get the job details to get the retry count
      const jobDetails = await boss.getJobById(jobId)
      console.log(`job details: ${JSON.stringify(jobDetails)}`)

      // if we exhausted retries, put the domain on HOLD and drop any lingering verification jobs
      if (jobDetails?.retrycount >= DOMAIN_VERIFICATION_RETRY_LIMIT) {
        console.log(`couldn't verify domain with ID ${domainId} after ${DOMAIN_VERIFICATION_RETRY_LIMIT} retries, putting it on HOLD and deleting any related domain verification jobs`)
        await models.domain.update({ where: { id: domainId }, data: { status: 'HOLD' } })

        // delete any related domain verification jobs
        await cleanDomainVerificationJobs(domainId, models)
      }
    } catch (cleanupError) {
      console.error(`post-failure cleanup for domain ${domainId} failed: ${cleanupError.message}`)
    }

    // rethrow the original error
    throw error
  } finally {
    // close prisma connection
    await models.$disconnect()
  }
}

async function verifyDomain (domain, models) {
  // bail with FAILED if the domain has been on PENDING for too long; domain will be put on HOLD,
  // the DB trigger will delete the certificate (if any), which cascades into the ACM cleanup trigger.
  if (datePivot(new Date(), { days: -DOMAIN_VERIFICATION_HOLD_AFTER_DAYS }) > domain.updatedAt) {
    return { status: 'FAILED', message: `Domain ${domain.domainName} has been put on HOLD because we couldn't verify it for the last ${DOMAIN_VERIFICATION_HOLD_AFTER_DAYS} days` }
  }

  const status = 'PENDING'

  // STEP 1: Check DNS each time
  // map the records to a dictionary
  const records = domain.records || []
  const recordMap = Object.fromEntries(records.map(record => [record.type, record]))

  // verify the CNAME record
  const dnsVerified = await verifyRecord('CNAME', recordMap.CNAME, domain, models)
  if (!dnsVerified) return { status, message: 'DNS verification has failed.' }

  // STEP 2: Request a certificate, get its validation values and check ACM validation
  // AWS external calls can fail, we'll catch the error for pgboss to retry the job
  try {
    // STEP 2a: Request a certificate
    let certificateArn = domain.certificate?.certificateArn || null
    // reuse the describeCertificate response across steps 2a and 2b when we just issued the cert
    let freshCertificate = null
    if (!certificateArn) {
      const issued = await requestCertificate(domain, models)
      certificateArn = issued.certificateArn
      freshCertificate = issued.certificate
    }

    // STEP 2b: Get the validation values for the certificate
    if (certificateArn && !recordMap.SSL) {
      await getACMValidationValues(domain, models, certificateArn, freshCertificate)

      // return PENDING to check ACM validation later
      return { status, message: 'Certificate issued and validation values stored.' }
    }

    // STEP 2c: Check ACM validation
    const sslStatus = await checkACMValidation(domain, models, recordMap.SSL)
    if (sslStatus === 'FAILED') {
      return { status: 'FAILED', message: `ACM certificate for ${domain.domainName} is in a terminal failed state.` }
    }
    if (sslStatus !== 'VERIFIED') return { status, message: 'ACM validation is still pending.' }

    // STEP 2d: Attach the certificate to the ELB listener
    await attachACMCertificateToELB(domain, models, certificateArn)
  } catch (error) {
    await logAttempt({ domain, models, stage: 'GENERAL', status, message: 'ACM services error: ' + error.message })
    throw error
  }

  // STEP 3: domain is verified
  return { status: 'VERIFIED', message: `Domain ${domain.domainName} has been successfully verified` }
}

// verify a single record, logs the result and returns true if the record is valid
async function verifyRecord (type, record, domain, models) {
  if (!record) {
    const message = `${type} record not found`
    await logAttempt({ domain, models, record: null, stage: type, status: 'PENDING', message })
    return false
  }

  const result = await verifyDNSRecord(type, record.recordName, record.recordValue)
  const status = result.valid ? 'VERIFIED' : 'PENDING'
  const message = result.valid ? `${type} record verified` : result.error?.message || `${type} record is not valid`

  // log the record verification attempt
  await logAttempt({ domain, models, record, stage: type, status, message })
  return status === 'VERIFIED'
}

// request a certificate for the domain from ACM
// returns { certificateArn, certificate }
async function requestCertificate (domain, models) {
  let message = null

  // ask ACM to request a certificate for the domain
  const { certificateArn, error: requestError } = await issueDomainCertificate(domain.domainName, domain.id)

  if (!certificateArn) {
    message = 'Could not request an ACM certificate: ' + requestError?.message
    throw new Error(message)
  }

  // describe the certificate to get the status and validation values
  const { certificate, error: describeError } = await certDetails(certificateArn)
  if (describeError) {
    message = 'Could not check certificate status: ' + describeError?.message
    throw new Error(message)
  }

  const certStatus = extractCertificateStatus(certificate)

  try {
    // store the certificate in the database with its status
    await models.domainCertificate.create({
      data: {
        domain: { connect: { id: domain.id } },
        certificateArn,
        status: certStatus
      }
    })
    message = 'An ACM certificate with arn ' + certificateArn + ' has been successfully requested'
  } catch (e) {
    // if record already exists, move on
    if (e.code === 'P2002') {
      message = 'Certificate already stored'
    } else {
      message = 'Could not store certificate in the database: ' + e.message
      throw new Error(message)
    }
  }

  await logAttempt({ domain, models, stage: 'ACM_REQUEST_CERTIFICATE', status: 'PENDING', message })
  return { certificateArn, certificate }
}

async function getACMValidationValues (domain, models, certificateArn, certificate = null) {
  let message = null

  // get the validation values for the certificate
  const { cname, value, error } = await getValidationValues(certificateArn, certificate)
  if (cname && value) {
    try {
      // store the validation values in the database
      await models.domainVerificationRecord.create({
        data: {
          domain: { connect: { id: domain.id } },
          type: 'SSL',
          recordName: cname,
          recordValue: value
        }
      })
      message = 'Validation values stored'
    } catch (e) {
      // if record already exists, move on
      if (e.code === 'P2002') {
        message = 'Validation values already stored'
      } else {
        message = 'Could not store validation values: ' + e.message
        throw new Error(message)
      }
    }
  } else {
    message = 'Could not get validation values: ' + error?.message
    throw new Error(message)
  }

  const status = cname && value ? 'PENDING' : 'FAILED'
  await logAttempt({ domain, models, stage: 'ACM_REQUEST_VALIDATION_VALUES', status, message })
  return status !== 'FAILED'
}

async function checkACMValidation (domain, models, record) {
  let message = null

  const { certStatus, error } = await checkCertificateStatus(domain.certificate.certificateArn)
  if (!error) {
    if (certStatus !== domain.certificate.status) {
      console.log(`certificate status for ${domain.domainName} has changed from ${domain.certificate.status} to ${certStatus}`)
      await models.domainCertificate.update({
        where: { id: domain.certificate.id },
        data: { status: certStatus }
      })
    }
    message = `Certificate status is: ${certStatus}`
  } else {
    message = 'Could not check certificate status: ' + error
    throw new Error(message)
  }

  let status
  if (certStatus === 'ISSUED') {
    status = 'VERIFIED'
  } else if (ACM_TERMINAL_FAILED_STATUSES.has(certStatus)) {
    status = 'FAILED'
    message = `ACM certificate is in a terminal failed state: ${certStatus}`
  } else {
    status = 'PENDING'
  }

  await logAttempt({ domain, models, record, stage: 'ACM_VALIDATION', status, message })
  return status
}

async function attachACMCertificateToELB (domain, models, certificateArn) {
  let message = null

  // attach the certificate to the ELB listener
  const { error } = await attachDomainCertificate(certificateArn)
  if (!error) {
    message = `Certificate ${certificateArn} is now attached to ELB listener`
  } else {
    message = `Could not attach certificate ${certificateArn} to ELB listener: ${error?.message}`
    throw new Error(message)
  }

  await logAttempt({ domain, models, stage: 'ELB_ATTACH_CERTIFICATE', status: 'VERIFIED', message })
  return true
}

async function logAttempt ({ domain, models, record, stage, status, message }) {
  const data = {
    domain: { connect: { id: domain.id } },
    stage,
    status,
    message
  }

  if (record) {
    data.verificationRecord = { connect: { id: record.id } }
  }

  return await models.domainVerificationAttempt.create({
    data
  })
}

// clear domains that have been on HOLD past the retention window
export async function clearLongHeldDomains () {
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })
  try {
    const deleted = await models.domain.deleteMany({
      where: {
        status: 'HOLD',
        updatedAt: { lt: datePivot(new Date(), { days: -DOMAIN_HOLD_RETENTION_DAYS }) }
      }
    })

    if (deleted.count > 0) {
      console.log(`cleared ${deleted.count} custom domains that have been on HOLD for ${DOMAIN_HOLD_RETENTION_DAYS} days or more`)
    }
  } catch (error) {
    console.error(`couldn't clear old domains that have been on HOLD: ${error.message}`)
  } finally {
    await models.$disconnect()
  }
}

// delete certificates from ACM and ELB
export async function deleteCertificateExternal ({ data: { certificateArn } }) {
  // detach the certificate from the elb listener
  const { error: detachError } = await detachDomainCertificate(certificateArn)
  if (detachError) {
    console.error(`couldn't detach certificate with ARN ${certificateArn}: ${detachError.message}`)
    throw detachError
  }

  // delete the certificate from ACM
  const { error: deleteError } = await deleteDomainCertificate(certificateArn)
  if (deleteError) {
    console.error(`couldn't delete certificate with ARN ${certificateArn}: ${deleteError.message}`)
    throw deleteError
  }
}
