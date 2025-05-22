import createPrisma from '@/lib/create-prisma'
import { verifyDNSRecord, issueDomainCertificate, checkCertificateStatus, getValidationValues, deleteDomainCertificate } from '@/lib/domain-verification'
import { datePivot } from '@/lib/time'

const VERIFICATION_INTERVAL = (updatedAt) => {
  const pivot = datePivot(new Date(), { hours: -1 }) // 1 hour ago
  // after 1 hour, the verification interval is 5 minutes
  if (pivot > updatedAt) return 60 * 5
  // before 1 hour, the verification interval is 30 seconds
  return 30
}
const VERIFICATION_HOLD_THRESHOLD = -2 // 2 days ago

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

    console.log(`domainVerification: ${JSON.stringify(domain, null, 2)}`)

    // if we can't find the domain, bail without scheduling a retry
    if (!domain) {
      console.log(`domain with ID ${domainId} not found`)
      return
    }

    // start verification process
    const result = await verifyDomain(domain, models)
    console.log(`domain verification result: ${JSON.stringify(result)}`)

    // update the domain with the result and register the attempt
    await models.domain.update({
      where: { id: domainId },
      data: { status: result.status }
    })

    // log the general verification attempt
    await logAttempt({ domain, models, stage: 'VERIFICATION_COMPLETE', status: result.status, message: result.message })

    // if the result is PENDING it means we still have to verify the domain
    // if it's not PENDING, we stop the verification process.
    if (result.status === 'PENDING') {
      // we still need to verify the domain, schedule the job to run again
      const newJobId = await boss.sendDebounced('domainVerification', { domainId }, {
        startAfter: VERIFICATION_INTERVAL(domain.updatedAt),
        retryLimit: 3,
        retryDelay: 60 // on critical errors, retry every minute
      }, 30, `domainVerification:${domainId}`)
      console.log(`domain ${domain.domainName} is still pending verification, created job with ID ${newJobId} to run in 5 minutes`)
    }
  } catch (error) {
    console.error(`couldn't verify domain with ID ${domainId}: ${error.message}`)

    // get the job details to get the retry count
    const jobDetails = await boss.getJobById(jobId)
    console.log(`job details: ${JSON.stringify(jobDetails)}`)

    // if we couldn't verify the domain after 3 attempts, put it on hold if it exists and delete any related verification jobs
    if (jobDetails?.retrycount >= 3) {
      console.log(`couldn't verify domain with ID ${domainId} for the third time, putting it on HOLD if it exists and deleting any related domain verification jobs`)
      await models.domain.update({ where: { id: domainId }, data: { status: 'HOLD' } })

      // delete any related domain verification jobs that may exist
      await models.$queryRaw`
      DELETE FROM pgboss.job
      WHERE name = 'domainVerification'
            AND data->>'domainId' = ${domainId}::TEXT`
    }

    throw error
  } finally {
    // close prisma connection
    await models.$disconnect()
  }
}

async function verifyDomain (domain, models) {
  // if we're still here and it has been 48 hours, put the domain on HOLD, stopping the verification process
  if (datePivot(new Date(), { days: VERIFICATION_HOLD_THRESHOLD }) > domain.updatedAt) {
    // delete certificate infos if any, it will trigger a deleteCertificate job
    // an ACM certificate would expire in 72 hours anyway, it's best to delete it
    await models.domainCertificate.delete({ where: { domainId: domain.id } })
    return { status: 'HOLD', message: `Domain ${domain.domainName} has been put on HOLD because we couldn't verify it in 48 hours` }
  }

  const status = 'PENDING'

  // STEP 1: Check DNS each time
  // map the records to a dictionary
  const records = domain.records || []
  const recordMap = Object.fromEntries(records.map(record => [record.type, record]))

  // verify both CNAME and TXT records
  const dnsVerified = await verifyDNS(domain, models, recordMap)
  if (!dnsVerified) return { status, message: 'DNS verification has failed.' }

  // STEP 2: Request a certificate, get its validation values and check ACM validation
  // AWS external calls can fail, we'll catch the error for pgboss to retry the job
  try {
    // STEP 2a: Request a certificate
    let certificateArn = domain.certificate?.certificateArn || null
    if (!certificateArn) {
      certificateArn = await requestCertificate(domain, models)
      if (!certificateArn) return { status, message: 'Certificate issuance has failed.' }
    }

    // STEP 2b: Get the validation values for the certificate
    if (certificateArn && !recordMap.SSL) {
      const validationValues = await getACMValidationValues(domain, models, certificateArn)
      if (!validationValues) return { status, message: 'Could not get validation values.' }

      // return PENDING to check ACM validation later
      return { status, message: 'Certificate issued and validation values stored.' }
    }

    // STEP 2c: Check ACM validation
    const sslVerified = await checkACMValidation(domain, models, recordMap.SSL)
    if (!sslVerified) return { status, message: 'ACM validation has failed.' }
  } catch (error) {
    await logAttempt({ domain, models, stage: 'GENERAL', status, message: 'ACM services error: ' + error.message })
    throw error
  }

  // STEP 3: If everything is verified, update the domain status to ACTIVE
  return { status: 'ACTIVE', message: `Domain ${domain.domainName} has been successfully verified` }
}

// verify both CNAME and TXT records
async function verifyDNS (domain, models, records) {
  if (records.CNAME && records.TXT) {
    const [cnameResult, txtResult] = await Promise.all([
      verifyRecord('CNAME', records.CNAME, domain, models),
      verifyRecord('TXT', records.TXT, domain, models)
    ])
    return cnameResult && txtResult
  }

  return false
}

// verify a single record, logs the result and returns true if the record is valid
async function verifyRecord (type, record, domain, models) {
  const result = await verifyDNSRecord(type, record.recordName, record.recordValue)
  const status = result.valid ? 'VERIFIED' : 'PENDING'
  const message = result.valid ? `${type} record verified` : result.error || `${type} record is not valid`

  // log the record verification attempt
  await logAttempt({ domain, models, record, stage: type, status, message })
  return status === 'VERIFIED'
}

// request a certificate for the domain from ACM
async function requestCertificate (domain, models) {
  let message = null

  // ask ACM to request a certificate for the domain
  const { certificateArn, error } = await issueDomainCertificate(domain.domainName)

  if (certificateArn) {
    // check the status of the just created certificate
    const { certStatus, error: checkError } = await checkCertificateStatus(certificateArn)
    if (checkError) {
      message = 'Could not check certificate status: ' + checkError
    } else {
      // store the certificate in the database with its status
      await models.domainCertificate.create({
        data: {
          domain: { connect: { id: domain.id } },
          certificateArn,
          status: certStatus
        }
      })
      message = 'An ACM certificate with arn ' + certificateArn + ' has been successfully requested'
    }
  } else {
    message = 'Could not request an ACM certificate: ' + error
  }

  const status = certificateArn ? 'PENDING' : 'FAILED'
  await logAttempt({ domain, models, stage: 'ACM_REQUEST_CERTIFICATE', status, message })
  return certificateArn
}

async function getACMValidationValues (domain, models, certificateArn) {
  let message = null

  // get the validation values for the certificate
  const { cname, value, error } = await getValidationValues(certificateArn)
  if (cname && value) {
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
  } else {
    message = 'Could not get validation values: ' + error
  }

  const status = cname && value ? 'PENDING' : 'FAILED'
  await logAttempt({ domain, models, stage: 'ACM_REQUEST_VALIDATION_VALUES', status, message })
  return status !== 'FAILED'
}

async function checkACMValidation (domain, models, record) {
  let message = null

  const { certStatus, error } = await checkCertificateStatus(domain.certificate.certificateArn)
  if (certStatus) {
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
  }

  const status = certStatus === 'ISSUED' ? 'VERIFIED' : 'PENDING'
  await logAttempt({ domain, models, record, stage: 'ACM_VALIDATION', status, message })
  return status === 'VERIFIED'
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

  console.log(`logAttempt: ${JSON.stringify(data, null, 2)}`)

  return await models.domainVerificationAttempt.create({
    data
  })
}

// clear domains that have been on HOLD for 30 days or more
export async function clearLongHeldDomains () {
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })
  try {
    await models.domain.deleteMany({
      where: { status: 'HOLD', updatedAt: { lt: datePivot(new Date(), { days: 30 }) } }
    })
  } catch (error) {
    console.error(`couldn't clear long held domains: ${error.message}`)
  } finally {
    await models.$disconnect()
  }
}

// delete certificates from ACM
export async function deleteCertificateExternal ({ data: { certificateArn } }) {
  const { error } = await deleteDomainCertificate(certificateArn)
  if (error) {
    console.error(`couldn't delete certificate with ARN ${certificateArn}: ${error.message}`)
    throw error
  }
}
