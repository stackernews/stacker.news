import { requestCertificate, getCertificateStatus, describeCertificate } from '@/api/acm'
import { Resolver } from 'node:dns/promises'

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

  return certStatus
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
  if (!certificate || !certificate.Certificate || !certificate.Certificate.DomainValidationOptions) {
    return { cname: null, value: null }
  }

  console.log(certificate.Certificate.DomainValidationOptions)
  return {
    cname: certificate.Certificate.DomainValidationOptions[0]?.ResourceRecord?.Name || null,
    value: certificate.Certificate.DomainValidationOptions[0]?.ResourceRecord?.Value || null
  }
}

// Verify the DNS records for a custom domain
export async function verifyDNSRecord (type, recordName, recordValue) {
  const result = {
    valid: false,
    error: null
  }

  // by default use cloudflare DNS resolver
  const resolver = new Resolver()
  resolver.setServers([process.env.DNS_RESOLVER || '1.1.1.1'])

  let domainRecords = null

  try {
    switch (type) {
      case 'TXT':
        // TXT Records checking
        domainRecords = await resolver.resolveTxt(recordName)
        result.valid = domainRecords.flat().join(' ').includes(recordValue)
        break
      case 'CNAME':
        // CNAME Records checking
        domainRecords = await resolver.resolveCname(recordName)
        result.valid = domainRecords.some(record =>
          record.includes(recordValue)
        )
        break
      default:
        result.error = `Invalid DNS record type: ${type}`
        break
    }
  } catch (error) {
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      result.error = `DNS record not found: ${error.code}`
    } else {
      result.error = `DNS error: ${error.message}`
    }
  }

  return result
}
