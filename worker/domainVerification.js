import createPrisma from '@/lib/create-prisma'
import { verifyDomainDNS, issueDomainCertificate, checkCertificateStatus, getValidationValues } from '@/lib/domains'

// TODO: Add comments
export async function domainVerification () {
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    const domains = await models.customDomain.findMany({ where: { OR: [{ dnsState: 'PENDING' }, { sslState: 'PENDING' }] } })

    for (const domain of domains) {
      try {
        const data = { ...domain, lastVerifiedAt: new Date() }
        // DNS verification
        if (data.dnsState === 'PENDING' || data.dnsState === 'FAILED') {
          const { txtValid, cnameValid } = await verifyDomainDNS(domain.name, domain.verificationTxt)
          console.log(`${domain.name}: TXT ${txtValid ? 'valid' : 'invalid'}, CNAME ${cnameValid ? 'valid' : 'invalid'}`)
          data.dnsState = txtValid && cnameValid ? 'VERIFIED' : 'FAILED'
        }

        // SSL issuing
        if (data.dnsState === 'VERIFIED' && (!data.certificateArn || data.sslState === 'FAILED')) {
          const certificateArn = await issueDomainCertificate(domain.name)
          console.log(`${domain.name}: Certificate issued: ${certificateArn}`)
          if (certificateArn) {
            const sslState = await checkCertificateStatus(certificateArn)
            console.log(`${domain.name}: Issued certificate status: ${sslState}`)
            if (sslState === 'PENDING') {
              try {
                const { cname, value } = await getValidationValues(certificateArn)
                data.verificationCname = cname
                data.verificationCnameValue = value
              } catch (error) {
                console.error(`Failed to get validation values for domain ${domain.name}:`, error)
              }
            }
            if (sslState) data.sslState = sslState
            data.certificateArn = certificateArn
          } else {
            data.sslState = 'FAILED'
          }
        }

        // SSL checking
        if (data.dnsState === 'VERIFIED' && data.sslState === 'PENDING') {
          const sslState = await checkCertificateStatus(data.certificateArn)
          console.log(`${domain.name}: Certificate status: ${sslState}`)
          if (sslState) data.sslState = sslState
        }

        await models.customDomain.update({ where: { id: domain.id }, data })
      } catch (error) {
        // TODO: this declares any error as a DNS verification error, we should also consider SSL verification errors
        console.error(`Failed to verify domain ${domain.name}:`, error)

        // TODO: DNS inconcistencies can happen, we should retry at least 3 times before marking it as FAILED
        // Update to FAILED on any error
        await models.customDomain.update({
          where: { id: domain.id },
          data: { dnsState: 'FAILED', lastVerifiedAt: new Date() }
        })
      }
    }
  } catch (error) {
    console.error(error)
  }
}
