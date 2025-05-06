import createPrisma from '@/lib/create-prisma'
import { verifyDNSRecord, issueDomainCertificate, checkCertificateStatus, getValidationValues, deleteCertificate } from '@/lib/domain-verification'
import { datePivot } from '@/lib/time'

const VERIFICATION_INTERVAL = 60 * 5 // 5 minutes
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
        attempts: true,
        certificate: true
      }
    })

    console.log(`domainVerification: ${JSON.stringify(domain)}`)

    // if we can't find the domain, bail without scheduling a retry
    if (!domain) {
      console.log(`domain with ID ${domainId} not found`)
      return
    }

    // start verification process
    const result = await verifyDomain(domain, models)
    console.log(`domain verification result: ${JSON.stringify(result)}`)

    // update the domain with the result
    await models.$transaction([
      models.domain.update({
        where: { id: domainId },
        data: { status: result.status }
      }),
      models.domainVerificationAttempt.create({
        data: {
          domain: { connect: { id: domainId } },
          status: result.status,
          message: result.message
        }
      })
    ])

    // if the result is PENDING it means we still have to verify the domain
    // if it's not PENDING, we stop the verification process.
    if (result.status === 'PENDING') {
      // we still need to verify the domain, schedule the job to run again
      const newJobId = await boss.send('domainVerification', { domainId }, {
        startAfter: VERIFICATION_INTERVAL,
        retryLimit: 3,
        retryDelay: 60 // on critical errors, retry every minute
      })
      console.log(`domain ${domain.domainName} is still pending verification, created job with ID ${newJobId} to run in 5 minutes`)
    }
  } catch (error) {
    console.error(`couldn't verify domain with ID ${domainId}: ${error.message}`)

    // get the job details to get the retry count
    const jobDetails = await boss.getJobById(jobId)
    console.log(`job details: ${JSON.stringify(jobDetails)}`)

    // if we couldn't verify the domain, put it on hold if it exists and delete any related verification jobs
    if (jobDetails?.retrycount >= 3) {
      console.log(`couldn't verify domain with ID ${domainId} for the third time, putting it on HOLD if it exists and deleting any related domain verification jobs`)
      await models.domain.update({ where: { id: domainId }, data: { status: 'HOLD' } })

      // delete any related domain verification jobs
      await models.$queryRaw`
      DELETE FROM pgboss.job
      WHERE name = 'domainVerification'
            AND data->>'domainId' = ${domainId}::TEXT`
    }

    throw error
  }
}

async function verifyDomain (domain, models) {
  const status = 'PENDING'
  const records = domain.records || []

  // map the records to a dictionary
  const recordMap = records.reduce((acc, record) => {
    acc[record.type] = record
    return acc
  }, {})

  // step 1: verify critical DNS records each time
  const dnsVerified = await verifyDNS(domain, models, recordMap)
  if (!dnsVerified) {
    return {
      status,
      message: 'DNS verification has failed.'
    }
  }

  // step 2: issue the certificate if it doesn't exist
  if (!domain.certificate) {
    const certificateArn = await issueCertificate(domain, models)
    if (!certificateArn) {
      return {
        status,
        message: 'Certificate issuance has failed.'
      }
    }

    // step 2b: get the validation values for the certificate
    const validationValues = await getACMValidationValues(domain, models, certificateArn)
    if (!validationValues) {
      return {
        status,
        message: 'Couldn\'t get validation values.'
      }
    }

    // if we got here, the certificate was issued and the validation values were stored,
    // so we need to check if the certificate is validated by ACM on the next job
    return {
      status,
      message: 'Certificate issued and validation values stored.'
    }
  }

  // step 3: check if the certificate is validated by ACM
  let sslVerified = false
  if (domain.certificate && recordMap.SSL) {
    const result = await checkACMValidation(domain, models, recordMap.SSL)
    console.log(`ACM validation result: ${JSON.stringify(result)}`)
    if (!result) {
      return {
        status,
        message: 'ACM validation has failed.'
      }
    }
    sslVerified = result
  }

  if (dnsVerified && sslVerified) {
    return {
      status: 'ACTIVE',
      message: `Domain ${domain.domainName} has been successfully verified`
    }
  } else if (datePivot(new Date(), { days: VERIFICATION_HOLD_THRESHOLD }) > domain.updatedAt) {
    // if the domain has been on verification for more than 48 hours,
    // delete the certificate and put it on HOLD.
    if (domain.certificate) {
      await deleteCertificate(domain.certificate.certificateArn)
    }

    return {
      status: 'HOLD',
      message: `Domain ${domain.domainName} has been on hold because we couldn't verify it in 48 hours`
    }
  }

  return {
    status: 'PENDING',
    message: `Domain ${domain.domainName} is still pending verification`
  }
}

async function verifyDNS (domain, models, records) {
  if (records.CNAME && records.TXT) {
    const cnameResult = await verifyRecord('CNAME', records.CNAME, domain, models)
    const txtResult = await verifyRecord('TXT', records.TXT, domain, models)
    return cnameResult && txtResult
  }

  return false
}

async function verifyRecord (type, record, domain, models) {
  const result = await verifyDNSRecord(type, record.recordName, record.recordValue)
  const status = result.valid ? 'VERIFIED' : 'PENDING'
  const message = result.valid ? `${type} record verified` : result.error || `${type} record is not valid`

  await logAttempt({ domain, models, record, status, message })
  return status !== 'PENDING'
}

// this returns the certificateArn if it was issued successfully
async function issueCertificate (domain, models) {
  let message = null

  // ask ACM to issue a certificate for the domain
  const certificateArn = await issueDomainCertificate(domain.domainName)

  if (certificateArn) {
    // check the status of the just issued certificate
    const certificateStatus = await checkCertificateStatus(certificateArn)
    // store the certificate in the database with its status
    await models.domainCertificate.create({
      data: {
        domain: { connect: { id: domain.id } },
        certificateArn,
        status: certificateStatus
      }
    })
    message = 'Certificate issued'
  } else {
    message = 'Couldn\'t issue certificate'
  }

  const status = certificateArn ? 'PENDING' : 'FAILED'
  await logAttempt({ domain, models, status, message })
  return certificateArn
}

async function getACMValidationValues (domain, models, certificateArn) {
  let message = null
  // get the validation values for the certificate
  const validationValues = await getValidationValues(certificateArn)
  if (validationValues) {
    // store the validation values in the database
    await models.domainVerificationRecord.create({
      data: {
        domain: { connect: { id: domain.id } },
        type: 'SSL',
        recordName: validationValues.cname,
        recordValue: validationValues.value
      }
    })
    message = 'Validation values stored'
  } else {
    message = 'Couldn\'t get validation values'
  }

  const status = validationValues ? 'PENDING' : 'FAILED'
  await logAttempt({ domain, models, status, message })
  return status !== 'FAILED'
}

async function checkACMValidation (domain, models, record) {
  let message = null
  const certificateStatus = await checkCertificateStatus(domain.certificate.certificateArn)

  if (certificateStatus) {
    if (certificateStatus !== domain.certificate.status) {
      console.log(`certificate status for ${domain.domainName} has changed from ${domain.certificate.status} to ${certificateStatus}`)
      await models.domainCertificate.update({
        where: { id: domain.certificate.id },
        data: { status: certificateStatus }
      })
    }
    message = `Certificate status is: ${certificateStatus}`
  } else {
    message = 'Couldn\'t check certificate status'
  }

  const status = certificateStatus === 'ISSUED' ? 'VERIFIED' : 'PENDING'
  await logAttempt({ domain, models, record, status, message })
  return status !== 'PENDING'
}

async function logAttempt ({ domain, models, record, status, message }) {
  const data = {
    domain: { connect: { id: domain.id } },
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
