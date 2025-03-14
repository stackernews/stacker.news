import { requestCertificate, getCertificateStatus } from '@/api/acm'
import { promises as dnsPromises } from 'node:dns'

// TODO: skeleton
export async function issueDomainCertificate (domainName) {
  try {
    const certificateArn = await requestCertificate(domainName)
    return certificateArn
  } catch (error) {
    console.error(`Failed to issue certificate for domain ${domainName}:`, error)
    return null
  }
}

// TODO: skeleton
export async function checkCertificateStatus (certificateArn) {
  let certStatus
  try {
    certStatus = await getCertificateStatus(certificateArn)
  } catch (error) {
    console.error(`Certificate status check failed: ${error.message}`)
    return 'FAILED'
  }

  // map ACM statuses
  switch (certStatus) {
    case 'ISSUED':
      return 'ISSUED'
    case 'PENDING_VALIDATION':
      return 'PENDING'
    case 'VALIDATION_TIMED_OUT':
    case 'FAILED':
      return 'FAILED'
    default:
      return 'PENDING'
  }
}

export async function verifyDomainDNS (domainName, verificationTxt, cname) {
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
