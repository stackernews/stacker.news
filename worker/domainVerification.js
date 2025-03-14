import createPrisma from '@/lib/create-prisma'
import { verifyDomainDNS, issueDomainCertificate, checkCertificateStatus } from '@/lib/domains'

// TODO: Add comments
export async function domainVerification () {
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    const domains = await models.customDomain.findMany()

    for (const domain of domains) {
      const { domain: domainName, verificationTxt, cname, id } = domain
      try {
        const data = { lastVerifiedAt: new Date() }
        // DNS verification
        if (domain.dnsState === 'PENDING' || domain.dnsState === 'FAILED') {
          const { txtValid, cnameValid } = await verifyDomainDNS(domainName, verificationTxt, cname)
          console.log(`${domainName}: TXT ${txtValid ? 'valid' : 'invalid'}, CNAME ${cnameValid ? 'valid' : 'invalid'}`)
          data.dnsState = txtValid && cnameValid ? 'VERIFIED' : 'FAILED'
        }

        // SSL issuing
        if (domain.dnsState === 'VERIFIED' && (domain.sslState === 'NOT_ISSUED' || domain.sslState === 'FAILED')) {
          const certificateArn = await issueDomainCertificate(domainName)
          console.log(`${domainName}: Certificate issued: ${certificateArn}`)
          if (certificateArn) {
            const sslState = await checkCertificateStatus(certificateArn)
            console.log(`${domainName}: Issued certificate status: ${sslState}`)
            if (sslState) data.sslState = sslState
            data.certificateArn = certificateArn
          }
        }

        // SSL checking
        if (domain.dnsState === 'VERIFIED' && domain.sslState === 'PENDING') {
          const sslState = await checkCertificateStatus(domain.certificateArn)
          console.log(`${domainName}: Certificate status: ${sslState}`)
          if (sslState) data.sslState = sslState
        }

        await models.customDomain.update({ where: { id }, data })
      } catch (error) {
        console.error(`Failed to verify domain ${domainName}:`, error)

        // TODO: DNS inconcistencies can happen, we should retry at least 3 times before marking it as FAILED
        // Update to FAILED on any error
        await models.customDomain.update({
          where: { id },
          data: { dnsState: 'FAILED', lastVerifiedAt: new Date() }
        })
      }
    }
  } catch (error) {
    console.error(error)
  }
}
