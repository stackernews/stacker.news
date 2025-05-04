import createPrisma from '@/lib/create-prisma'
import { verifyDNSRecord, issueDomainCertificate, checkCertificateStatus, getValidationValues, deleteCertificate } from '@/lib/domain-verification'

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
    await models.domain.update({
      where: { id: domainId },
      data: { status: result.status }
    })

    // if the result is PENDING it means we still have to verify the domain
    // if it's not PENDING, we stop the verification process.
    if (result.status === 'PENDING') {
      // we still need to verify the domain, schedule the job to run again in 5 minutes
      const jobId = await boss.send('domainVerification', { domainId }, {
        startAfter: 60 * 5, // start the job after 5 minutes
        retryLimit: 3,
        retryDelay: 30 // on critical errors, retry every 5 minutes
      })
      console.log(`domain ${domain.domainName} is still pending verification, created job with ID ${jobId} to run in 5 minutes`)
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
  const records = domain.records || []

  // map the records to a dictionary
  const recordMap = records.reduce((acc, record) => {
    acc[record.type] = record
    return acc
  }, {})

  // step 1: verify CNAME
  const cnameRecord = recordMap.CNAME || null
  const txtRecord = recordMap.TXT || null

  let cnameResult = null
  let txtResult = null

  if (cnameRecord) {
    cnameResult = await verifyRecord('CNAME', cnameRecord, domain, models)
    console.log(`cname verification result: ${JSON.stringify(cnameResult)}`)
  }

  // step 2: verify TXT
  if (txtRecord) {
    txtResult = await verifyRecord('TXT', txtRecord, domain, models)
    console.log(`txt verification result: ${JSON.stringify(txtResult)}`)
  }

  // if both CNAME and TXT are verified, we can consider the DNS stage complete
  const dnsVerified = cnameResult?.status === 'VERIFIED' && txtResult?.status === 'VERIFIED'
  if (!dnsVerified) {
    console.log(`DNS verification has failed, please check the CNAME and TXT records for ${domain.domainName}`)
    return {
      status: 'PENDING',
      message: `DNS verification has failed, CNAME: ${cnameResult?.message}, TXT: ${txtResult?.message}`
    }
  }

  // if the DNS stage is complete, we can issue the certificate
  // step 3: issue the certificate if it doesn't exist
  if (!domain.certificate) {
    const certificateArn = await issueDomainCertificate(domain.domain)
    const certificateStatus = await checkCertificateStatus(certificateArn)

    if (certificateArn) {
      await models.domainCertificate.create({
        data: {
          domain: { connect: { id: domain.id } },
          certificateArn,
          status: certificateStatus
        }
      })

      const validationValues = await getValidationValues(certificateArn)
      if (validationValues) {
        await models.domainVerificationRecord.create({
          data: {
            domain: { connect: { id: domain.id } },
            type: 'SSL',
            recordName: validationValues.cname,
            recordValue: validationValues.value
          }
        })
      } else {
        console.log(`couldn't get validation values for certificate ${certificateArn}, will retry in 5 minutes`)
        return {
          status: 'PENDING',
          message: `couldn't get validation values for certificate ${certificateArn}, will retry in 5 minutes`
        }
      }
    } else {
      console.log(`couldn't issue certificate for ${domain.domainName}, will retry in 5 minutes`)
      return {
        status: 'PENDING',
        message: `couldn't issue certificate for ${domain.domainName}, will retry in 5 minutes`
      }
    }
  }

  const sslRecord = recordMap.SSL || null
  let sslVerified = false

  // step 3b: check if the certificate is validated by ACM
  if (domain.certificate && sslRecord) {
    const result = await verifyACMValidation(domain, models)
    console.log(`ACM validation result: ${JSON.stringify(result)}`)
    if (result.status === 'PENDING') {
      console.log(`ACM validation has failed, please check the SSL record for ${domain.domainName}`)
      return {
        status: 'PENDING',
        message: result.message
      }
    }
    sslVerified = result.status === 'VERIFIED'
  }

  if (dnsVerified && sslVerified) {
    return {
      status: 'ACTIVE',
      message: `Domain ${domain.domainName} has been successfully verified`
    }
  } else if (domain.createdAt > new Date(Date.now() - 1000 * 60 * 60 * 24 * 2)) {
    // if the domain has been on hold for more than 48 hours, delete the certificate, it would expire anyway
    await deleteCertificate(domain.certificate.certificateArn)
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

async function verifyRecord (type, record, domain, models) {
  const result = await verifyDNSRecord(type, record.recordName, record.recordValue)
  const newStatus = result.valid ? 'VERIFIED' : 'PENDING'
  const message = result.valid ? `${type} record verified` : result.error

  return await models.domainVerificationAttempt.create({
    data: {
      domain: { connect: { id: domain.id } },
      verificationRecord: { connect: { id: record.id } },
      status: newStatus,
      message
    }
  })
}

async function verifyACMValidation (domain, models) {
  const certificateStatus = await checkCertificateStatus(domain.certificate.certificateArn)
  const message = certificateStatus === 'VERIFIED' ? 'Certificate verified' : 'Certificate not verified'

  if (certificateStatus !== domain.certificate.status) {
    console.log(`certificate status for ${domain.domainName} has changed from ${domain.certificate.status} to ${certificateStatus}`)
    await models.domainCertificate.update({
      where: { id: domain.certificate.id },
      data: { status: certificateStatus }
    })
  }

  const newStatus = certificateStatus === 'ISSUED' ? 'VERIFIED' : 'PENDING'

  return await models.domainVerificationAttempt.create({
    data: {
      domain: { connect: { id: domain.id } },
      verificationRecord: { connect: { id: domain.certificate.id } },
      status: newStatus,
      message
    }
  })
}
