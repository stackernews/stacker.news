import createPrisma from '@/lib/create-prisma'
import { promises as dnsPromises } from 'node:dns'

// TODO: Add comments
export async function domainVerification () {
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    const domains = await models.customDomain.findMany()

    for (const domain of domains) {
      const { domain: domainName, verificationTxt, cname, id } = domain
      try {
        const { txtValid, cnameValid, error } = await verifyDomain(domainName, verificationTxt, cname)
        console.log(`${domainName}: TXT ${txtValid ? 'valid' : 'invalid'}, CNAME ${cnameValid ? 'valid' : 'invalid'}`)

        // verificationState is based on the results of the TXT and CNAME checks
        const verificationResult = txtValid && cnameValid
        const verificationState = verificationResult // TODO: clean this up, working proof of concept
          ? 'VERIFIED'
          : domain.verificationState === 'PENDING' && !verificationResult
            ? 'PENDING'
            : 'FAILED'
        await models.customDomain.update({
          where: { id },
          data: { verificationState, lastVerifiedAt: new Date() }
        })

        if (error) {
          console.log(`${domainName} verification error:`, error)
        }
      } catch (error) {
        console.error(`Failed to verify domain ${domainName}:`, error)

        // TODO: DNS inconcistencies can happen, we should retry at least 3 times before marking it as FAILED
        // Update to FAILED on any error
        await models.customDomain.update({
          where: { id },
          data: { verificationState: 'FAILED', lastVerifiedAt: new Date() }
        })
      }
    }
  } catch (error) {
    console.error(error)
  }
}

async function verifyDomain (domainName, verificationTxt, cname) {
  const result = {
    txtValid: false,
    cnameValid: false,
    error: null
  }

  dnsPromises.setServers([process.env.DNS_RESOLVER || '1.1.1.1']) // cloudflare DNS resolver

  // TXT Records checking
  // TODO: we should give a randomly generated string to the user and check if it's included in the TXT record
  try {
    const txtRecords = await dnsPromises.resolve(domainName, 'TXT')
    const txtText = txtRecords.flat().join(' ')

    // the TXT record should include the verificationTxt that we have in the database
    result.txtValid = txtText.includes(verificationTxt)
  } catch (error) {
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      result.error = `TXT record not found: ${error.code}`
    } else {
      result.error = `TXT error: ${error.message}`
    }
  }

  // CNAME Records checking
  try {
    const cnameRecords = await dnsPromises.resolve(domainName, 'CNAME')

    // the CNAME record should include the cname that we have in the database
    result.cnameValid = cnameRecords.some(record =>
      record.includes(cname)
    )
  } catch (error) {
    if (!result.error) { // this is to avoid overriding the error from the TXT check
      if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
        result.error = `CNAME record not found: ${error.code}`
      } else {
        result.error = `CNAME error: ${error.message}`
      }
    }
  }
  return result
}
