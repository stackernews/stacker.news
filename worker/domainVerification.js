import createPrisma from '@/lib/create-prisma'
import { verifyDomainDNS, issueDomainCertificate, checkCertificateStatus, getValidationValues } from '@/lib/domains'

// This worker verifies the DNS and SSL certificates for domains that are pending or failed
export async function domainVerification ({ data: { domainId }, boss }) {
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })
  console.log('domainVerification', domainId)
  const domain = await models.customDomain.findUnique({ where: { id: domainId } })
  console.log('domain', domain)
  const result = await verifyDomain(domain, models)

  let startAfter = null
  if (result?.failedAttempts < 5) {
    // every 30 seconds
    startAfter = new Date(Date.now() + 30 * 1000)
  } else {
    // every 10 minutes
    startAfter = new Date(Date.now() + 10 * 60 * 1000)
  }
  if (result?.status === 'PENDING') {
    await boss.send('domainVerification', { domainId }, { startAfter })
  }
}

async function verifyDomain (domain, models) {
  // track verification
  const data = { ...domain, lastVerifiedAt: new Date() }
  data.verification = data.verification || { dns: {}, ssl: {} }

  if (data.verification?.dns?.state !== 'VERIFIED') {
    await verifyDNS(data)
  }

  if (data.verification?.dns?.state === 'VERIFIED' && (!data.verification?.ssl?.arn || data.verification?.ssl?.state === 'FAILED')) {
    await issueCertificate(data)
  }

  if (data.verification?.dns?.state === 'VERIFIED' && data.verification?.ssl?.state !== 'VERIFIED' && data.verification?.ssl?.arn) {
    await updateCertificateStatus(data)
  }

  if (data.verification?.dns?.state === 'FAILED' || data.verification?.ssl?.state === 'FAILED') {
    data.failedAttempts += 1
    data.updatedAt = new Date()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    // todo: change this
    if (data.failedAttempts > 10 && data.updatedAt < oneDayAgo) {
      data.status = 'HOLD'
    }
  }

  if (data.verification?.dns?.state === 'VERIFIED' && data.verification?.ssl?.state === 'VERIFIED') {
    data.status = 'ACTIVE'
  }
  return await models.customDomain.update({ where: { id: domain.id }, data })
}

async function verifyDNS (data) {
  const { txtValid, cnameValid } = await verifyDomainDNS(data.domain, data.verification.dns.txt)
  console.log(`${data.domain}: TXT ${txtValid ? 'valid' : 'invalid'}, CNAME ${cnameValid ? 'valid' : 'invalid'}`)

  data.verification.dns.state = txtValid && cnameValid ? 'VERIFIED' : 'FAILED'
  return data
}

async function issueCertificate (data) {
  const certificateArn = await issueDomainCertificate(data.domain)
  console.log(`${data.domain}: Certificate issued: ${certificateArn}`)

  if (certificateArn) {
    const sslState = await checkCertificateStatus(certificateArn)
    console.log(`${data.domain}: Issued certificate status: ${sslState}`)

    if (sslState) data.verification.ssl.state = sslState
    data.verification.ssl.arn = certificateArn

    if (sslState !== 'VERIFIED') {
      try {
        const { cname, value } = await getValidationValues(certificateArn)
        data.verification.ssl.cname = cname
        data.verification.ssl.value = value
      } catch (error) {
        console.error(`Failed to get validation values for domain ${data.domain}:`, error)
      }
    }
  } else {
    data.verification.ssl.state = 'FAILED'
  }

  return data
}

async function updateCertificateStatus (data) {
  const sslState = await checkCertificateStatus(data.certificateArn)
  console.log(`${data.domain}: Certificate status: ${sslState}`)
  if (sslState) data.verification.ssl.state = sslState
  return data
}
