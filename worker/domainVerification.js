import createPrisma from '@/lib/create-prisma'
import { verifyDomainDNS, issueDomainCertificate, checkCertificateStatus, getValidationValues } from '@/lib/domains'

// This worker verifies the DNS and SSL certificates for domains that are pending or failed
// It will also delete domains that have failed to verify 5 times
export async function routineDomainVerification () {
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    const domains = await models.customDomain.findMany({
      where: {
        NOT: {
          AND: [{ dnsState: 'VERIFIED' }, { sslState: 'VERIFIED' }, { status: 'HOLD' }]
        }
      },
      orderBy: {
        failedAttempts: 'asc' // process domains with less failed attempts first
      }
    })

    await Promise.all(domains.map(async (domain) => {
      try {
        await verifyDomain(domain, models)
      } catch (error) {
        console.error(`Failed to verify domain ${domain.domain}:`, error)
        domain.failedAttempts += 1
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        if (domain.failedAttempts >= 5 && domain.updatedAt < oneDayAgo) {
          await models.customDomain.update({ where: { id: domain.id }, data: { status: 'HOLD' } })
        }
      }
    }))
  } catch (error) {
    console.error('cannot verify domains:', error)
  } finally {
    await models.$disconnect()
  }
}

export async function immediateDomainVerification ({ data: { domainId }, boss }) {
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })
  console.log('immediateDomainVerification', domainId)
  const domain = await models.customDomain.findUnique({ where: { id: domainId } })
  console.log('domain', domain)
  const result = await verifyDomain(domain, models)

  let startAfter = new Date(Date.now() + 30 * 1000)
  if (result?.failedAttempts < 5) {
    // every 30 seconds
    startAfter = new Date(Date.now() + 30 * 1000)
  } else {
    // every 10 minutes
    startAfter = new Date(Date.now() + 10 * 60 * 1000)
  }
  if (result?.status !== 'HOLD') {
    await boss.send('immediateDomainVerification', { domainId }, { startAfter })
  }
}

async function verifyDomain (domain, models) {
  // track verification
  const data = { ...domain, lastVerifiedAt: new Date() }

  if (data.dnsState !== 'VERIFIED') {
    await verifyDNS(data)
  }

  if (data.dnsState === 'VERIFIED' && (!data.certificateArn || data.sslState === 'FAILED')) {
    await issueCertificate(data)
  }

  if (data.dnsState === 'VERIFIED' && data.sslState !== 'VERIFIED') {
    await updateCertificateStatus(data)
  }

  if (data.dnsState === 'FAILED' || data.sslState === 'FAILED') {
    data.failedAttempts += 1
    data.updatedAt = new Date()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    // todo: change this
    if (data.failedAttempts > 10 && data.updatedAt < oneDayAgo) {
      data.status = 'HOLD'
    }
  }

  return await models.customDomain.update({ where: { id: domain.id }, data })
}

async function verifyDNS (data) {
  const { txtValid, cnameValid } = await verifyDomainDNS(data.domain, data.verificationTxt)
  console.log(`${data.domain}: TXT ${txtValid ? 'valid' : 'invalid'}, CNAME ${cnameValid ? 'valid' : 'invalid'}`)

  data.dnsState = txtValid && cnameValid ? 'VERIFIED' : 'FAILED'
  return data
}

async function issueCertificate (data) {
  const certificateArn = await issueDomainCertificate(data.domain)
  console.log(`${data.domain}: Certificate issued: ${certificateArn}`)

  if (certificateArn) {
    const sslState = await checkCertificateStatus(certificateArn)
    console.log(`${data.domain}: Issued certificate status: ${sslState}`)
    if (sslState !== 'VERIFIED') {
      try {
        const { cname, value } = await getValidationValues(certificateArn)
        data.verificationCname = cname
        data.verificationCnameValue = value
      } catch (error) {
        console.error(`Failed to get validation values for domain ${data.domain}:`, error)
      }
    }
    if (sslState) data.sslState = sslState
    data.certificateArn = certificateArn
  } else {
    data.sslState = 'FAILED'
  }

  return data
}

async function updateCertificateStatus (data) {
  const sslState = await checkCertificateStatus(data.certificateArn)
  console.log(`${data.domain}: Certificate status: ${sslState}`)
  if (sslState) data.sslState = sslState
  return data
}
