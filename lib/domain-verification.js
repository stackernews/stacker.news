import { requestCertificate, getCertificateStatus, describeCertificate } from '@/api/acm'
import { promises as dnsPromises } from 'node:dns'

// Issue a certificate for a custom domain
export async function issueDomainCertificate (domainName) {
  try {
    const certificateArn = await requestCertificate(domainName)
    return certificateArn
  } catch (error) {
    console.error(`Failed to issue certificate for domain ${domainName}:`, error)
    return null
  }
}

// Check the status of a certificate for a custom domain
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
      return 'VERIFIED'
    case 'PENDING_VALIDATION':
      return 'PENDING'
    case 'VALIDATION_TIMED_OUT':
    case 'FAILED':
      return 'FAILED'
    default:
      return 'PENDING'
  }
}

// Get the details of a certificate for a custom domain
export async function certDetails (certificateArn) {
  try {
    const certificate = await describeCertificate(certificateArn)
    return certificate
  } catch (error) {
    console.error(`Certificate description failed: ${error.message}`)
    return null
  }
}

// Get the validation values for a certificate for a custom domain
// TODO: Test with real values, localstack don't have this info until the certificate is issued
export async function getValidationValues (certificateArn) {
  const certificate = await certDetails(certificateArn)
  console.log(certificate.DomainValidationOptions)
  return {
    cname: certificate.DomainValidationOptions[0].ResourceRecord.Name,
    value: certificate.DomainValidationOptions[0].ResourceRecord.Value
  }
}

// Verify the DNS records for a custom domain
export async function verifyDomainDNS (domainName, verificationTxt, verificationCname) {
  const cname = verificationCname || process.env.NEXT_PUBLIC_URL.replace(/^https?:\/\//, '')
  const txtHost = `_snverify.${domainName}`
  const result = {
    txtValid: false,
    cnameValid: false,
    error: null
  }

  // by default use cloudflare DNS resolver
  dnsPromises.setServers([process.env.DNS_RESOLVER || '1.1.1.1'])

  // TXT Records checking
  try {
    const txtRecords = await dnsPromises.resolve(txtHost, 'TXT')
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
