import createPrisma from '@/lib/create-prisma'
import { verifyDomainDNS, issueDomainCertificate, checkCertificateStatus, getValidationValues, deleteCertificate } from '@/lib/domain-verification'

export async function domainVerification ({ id: jobId, data: { domainId }, boss }) {
  // establish connection to database
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })
  try {
    // get domain from database
    const domain = await models.customDomain.findUnique({ where: { id: domainId } })
    // if we can't find the domain, bail without scheduling a retry
    if (!domain) {
      throw new Error(`domain with ID ${domainId} not found`)
    }

    // start verification process
    const result = await verifyDomain(domain)
    console.log(`domain verification result: ${JSON.stringify(result)}`)

    // update the domain with the result
    await models.customDomain.update({
      where: { id: domainId },
      data: result
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
      console.log(`domain ${domain.domain} is still pending verification, created job with ID ${jobId} to run in 5 minutes`)
    }
  } catch (error) {
    console.error(`couldn't verify domain with ID ${domainId}: ${error.message}`)

    // get the job details to get the retry count
    const jobDetails = await boss.getJobById(jobId)
    console.log(`job details: ${JSON.stringify(jobDetails)}`)
    // if we couldn't verify the domain, put it on hold if it exists and delete any related verification jobs
    if (jobDetails?.retrycount >= 3) {
      console.log(`couldn't verify domain with ID ${domainId} for the third time, putting it on hold if it exists and deleting any related domain verification jobs`)
      await models.customDomain.update({ where: { id: domainId }, data: { status: 'HOLD' } })
      // delete any related domain verification jobs
      await models.$queryRaw`
      DELETE FROM pgboss.job
      WHERE name = 'domainVerification'
            AND data->>'domainId' = ${domainId}::TEXT`
    }

    throw error
  }
}

async function verifyDomain (domain) {
  const lastVerifiedAt = new Date()
  const verification = domain.verification || { dns: {}, ssl: {} }
  let status = domain.status || 'PENDING'

  // step 1: verify DNS [CNAME and TXT]
  // if DNS is not already verified
  let dnsState = verification.dns.state || 'PENDING'
  if (dnsState !== 'VERIFIED') {
    dnsState = await verifyDNS(domain.domain, verification.dns.txt)

    // log the result, throw an error if we couldn't verify the DNS
    switch (dnsState) {
      case 'VERIFIED':
        console.log(`DNS verification for ${domain.domain} is ${dnsState}, proceeding to SSL verification`)
        break
      case 'PENDING':
        console.log(`DNS verification for ${domain.domain} is ${dnsState}, will retry DNS verification in 5 minutes`)
        break
      default:
        dnsState = 'PENDING'
        console.log(`couldn't verify DNS for ${domain.domain}, will retry DNS verification in 5 minutes`)
    }
  }

  // step 2: certificate issuance
  // if DNS is verified and we don't have a SSL certificate, issue one
  let sslArn = verification.ssl.arn || null
  let sslState = verification.ssl.state || 'PENDING'
  if (dnsState === 'VERIFIED' && !sslArn) {
    sslArn = await issueDomainCertificate(domain.domain)
    if (sslArn) {
      console.log(`SSL certificate issued for ${domain.domain} with ARN ${sslArn}, will verify with ACM`)
    } else {
      console.log(`couldn't issue SSL certificate for ${domain.domain}, will retry certificate issuance in 5 minutes`)
    }
  }

  // step 3: get validation values from ACM
  // if we have a certificate and we don't already have the validation values
  let acmValidationCname = verification.ssl.cname || null
  let acmValidationValue = verification.ssl.value || null
  if (sslArn && !acmValidationCname && !acmValidationValue) {
    const values = await getValidationValues(sslArn)
    acmValidationCname = values?.cname || null
    acmValidationValue = values?.value || null
    if (acmValidationCname && acmValidationValue) {
      console.log(`Validation values retrieved for ${domain.domain}, will check ACM validation status`)
    } else {
      console.log(`couldn't retrieve validation values for ${domain.domain}, will retry to request validation values from ACM in 5 minutes`)
    }
  }

  // step 4: check if the certificate is validated by ACM
  // if DNS is verified and we have a SSL certificate
  // it can happen that we just issued the certificate and it's not yet validated by ACM
  if (sslArn && sslState !== 'VERIFIED') {
    sslState = await checkCertificateStatus(sslArn)
    switch (sslState) {
      case 'VERIFIED':
        console.log(`SSL certificate for ${domain.domain} is ${sslState}, verification routine complete`)
        break
      case 'PENDING':
        console.log(`SSL certificate for ${domain.domain} is ${sslState}, will check again with ACM in 5 minutes`)
        break
      default:
        sslState = 'PENDING'
        console.log(`couldn't verify SSL certificate for ${domain.domain}, will retry certificate validation with ACM in 5 minutes`)
    }
  }

  // step 5: update the status of the domain
  // if the domain is fully verified, set the status to active
  if (dnsState === 'VERIFIED' && sslState === 'VERIFIED') {
    status = 'ACTIVE'
  }
  // if the domain has failed in some way and it's been 48 hours, put it on hold
  if (status !== 'ACTIVE' && domain.createdAt < new Date(Date.now() - 1000 * 60 * 60 * 24 * 2)) {
    status = 'HOLD'
    // we stopped domain verification, delete the certificate as it will expire after 72 hours anyway
    if (sslArn) {
      console.log(`domain ${domain.domain} is on hold, deleting certificate as it will expire after 72 hours`)
      const result = await deleteCertificate(sslArn)
      console.log(`delete certificate attempt for ${domain.domain}, result: ${JSON.stringify(result)}`)
    }
  }

  return {
    lastVerifiedAt,
    status,
    verification: {
      dns: {
        ...verification.dns,
        state: dnsState
      },
      ssl: {
        arn: sslArn,
        state: sslState,
        cname: acmValidationCname,
        value: acmValidationValue
      }
    }
  }
}

async function verifyDNS (cname, txt) {
  const { cnameValid, txtValid } = await verifyDomainDNS(cname, txt)
  console.log(`${cname}: CNAME ${cnameValid ? 'valid' : 'invalid'}, TXT ${txtValid ? 'valid' : 'invalid'}`)

  const dnsState = cnameValid && txtValid ? 'VERIFIED' : 'PENDING'
  return dnsState
}
