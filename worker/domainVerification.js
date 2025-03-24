import createPrisma from '@/lib/create-prisma'
import { verifyDomainDNS, issueDomainCertificate, checkCertificateStatus, getValidationValues } from '@/lib/domains'

export async function domainVerification () {
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    const domains = await models.customDomain.findMany({
      where: {
        NOT: {
          AND: [{ dnsState: 'VERIFIED' }, { sslState: 'VERIFIED' }]
        }
      },
      orderBy: {
        failedAttempts: 'asc' // process domains with less failed attempts first
      }
    })

    for (const domain of domains) {
      try {
        // set lastVerifiedAt to now
        const data = { ...domain, lastVerifiedAt: new Date() }

        // DNS verification on pending or failed domains
        if (data.dnsState !== 'VERIFIED') {
          const { txtValid, cnameValid } = await verifyDomainDNS(data.domain, data.verificationTxt)
          console.log(`${data.domain}: TXT ${txtValid ? 'valid' : 'invalid'}, CNAME ${cnameValid ? 'valid' : 'invalid'}`)

          // update dnsState to VERIFIED if both TXT and CNAME are valid, otherwise set to FAILED
          data.dnsState = txtValid && cnameValid ? 'VERIFIED' : 'FAILED'
        }

        // issue SSL certificate for verified domains, if we didn't already or we failed to issue it
        if (data.dnsState === 'VERIFIED' && (!data.certificateArn || data.sslState === 'FAILED')) {
          // use ACM to issue a certificate for the domain
          const certificateArn = await issueDomainCertificate(data.domain)
          console.log(`${data.domain}: Certificate issued: ${certificateArn}`)
          if (certificateArn) {
            // get the status of the certificate
            const sslState = await checkCertificateStatus(certificateArn)
            console.log(`${data.domain}: Issued certificate status: ${sslState}`)
            // if we didn't validate already, obtain the ACM CNAME values for the certificate validation
            if (sslState !== 'VERIFIED') {
              try {
                // obtain the ACM CNAME values for the certificate validation
                // ACM will use these values to verify the domain
                const { cname, value } = await getValidationValues(certificateArn)
                data.verificationCname = cname
                data.verificationCnameValue = value
              } catch (error) {
                console.error(`Failed to get validation values for domain ${data.domain}:`, error)
              }
            }
            // update the sslState with the status of the certificate
            if (sslState) data.sslState = sslState
            data.certificateArn = certificateArn
          } else {
            // if we failed to issue the certificate, set the sslState to FAILED
            data.sslState = 'FAILED'
          }
        }

        // update the status of the certificate while pending
        if (data.dnsState === 'VERIFIED' && data.sslState !== 'VERIFIED') {
          const sslState = await checkCertificateStatus(data.certificateArn)
          console.log(`${data.domain}: Certificate status: ${sslState}`)
          if (sslState) data.sslState = sslState
        }

        // delete domain if any verification has failed 5 times
        if (data.dnsState === 'FAILED' || data.sslState === 'FAILED') {
          data.failedAttempts += 1
          if (data.failedAttempts >= 5) {
            return models.customDomain.delete({ where: { id: domain.id } })
          }
        } else {
          data.failedAttempts = 0
        }

        // update the domain with the new status
        await models.customDomain.update({ where: { id: domain.id }, data })
      } catch (error) {
        console.error(`Failed to verify domain ${domain.domain}:`, error)
        // Update to FAILED on any error
        await models.customDomain.update({
          where: { id: domain.id },
          data: {
            dnsState: 'FAILED',
            lastVerifiedAt: new Date(),
            failedAttempts: domain.failedAttempts + 1
          }
        })
      }
    }
  } catch (error) {
    console.error('cannot verify domains:', error)
  }
}
