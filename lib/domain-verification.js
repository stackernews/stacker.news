import { requestCertificate, getCertificateStatus, describeCertificate, deleteCertificate } from '@/api/acm'
import { detachCertificateFromElb, attachCertificateToElb } from '@/api/elb'
import { Resolver } from 'node:dns/promises'

// Issue a certificate for a custom domain
export async function issueDomainCertificate (domainName, domainId) {
  try {
    const certificateArn = await requestCertificate(domainName, domainId)
    return { certificateArn, error: null }
  } catch (error) {
    console.error(`Failed to issue certificate for domain ${domainName}:`, error)
    return { certificateArn: null, error }
  }
}

// Check the status of a certificate for a custom domain
export async function checkCertificateStatus (certificateArn) {
  let certStatus
  try {
    certStatus = await getCertificateStatus(certificateArn)
    return { certStatus, error: null }
  } catch (error) {
    console.error(`Certificate status check failed: ${error.message}`)
    return { certStatus: 'FAILED', error }
  }
}

// Get the details of a certificate for a custom domain
export async function certDetails (certificateArn) {
  try {
    const certificate = await describeCertificate(certificateArn)
    return { certificate, error: null }
  } catch (error) {
    console.error(`Certificate description failed: ${error.message}`)
    return { certificate: null, error }
  }
}

// derive the ACM status from a certificate
export function extractCertificateStatus (certificate) {
  return certificate?.Certificate?.Status ?? 'FAILED'
}

// derive the DNS validation values from a certificate
export function extractValidationValues (certificate) {
  const record = certificate?.Certificate?.DomainValidationOptions?.[0]?.ResourceRecord
  return {
    cname: record?.Name ?? null,
    value: record?.Value ?? null
  }
}

// Get the validation values for a certificate for a custom domain.
// reuse the certificate if provided, otherwise fetch it from ACM
export async function getValidationValues (certificateArn, certificate = null) {
  if (!certificate) {
    const { certificate: fetched, error } = await certDetails(certificateArn)
    if (error) {
      return { cname: null, value: null, error }
    }
    certificate = fetched
  }

  if (!certificate || !certificate.Certificate || !certificate.Certificate.DomainValidationOptions) {
    return { cname: null, value: null, error: { message: 'Certificate not found' } }
  }

  const { cname, value } = extractValidationValues(certificate)
  return { cname, value }
}

// Attach a certificate to the ELB listener
export async function attachDomainCertificate (certificateArn) {
  try {
    await attachCertificateToElb(certificateArn)
    return { error: null }
  } catch (error) {
    console.error(`Failed to attach certificate to elb: ${error.message}`)
    return { error }
  }
}

// Verify the DNS records for a custom domain
export async function verifyDNSRecord (type, recordName, recordValue) {
  const result = {
    valid: false,
    error: null
  }

  // DNS setup
  const resolver = new Resolver()
  const dnsServers = []
  try {
    const localDnsServer = process.env.DOMAINS_DNS_SERVER
    // use the dnsmasq DNS server in development
    if (process.env.NODE_ENV === 'development' && localDnsServer) {
      console.log('[node:dns] Using local development DNS server', localDnsServer)
      dnsServers.push(localDnsServer)
    }
    // fallback to the system DNS servers
    dnsServers.push(...resolver.getServers())
    resolver.setServers(dnsServers)
  } catch (error) {
    console.error(`[node:dns] Failed to set DNS servers: ${error.message}`)
    return { valid: false, error }
  }

  let domainRecords = null

  try {
    if (type === 'CNAME') {
      domainRecords = await resolver.resolveCname(recordName)
      if (domainRecords.length !== 1) {
        result.error = { message: `Invalid DNS configuration: expected 1 CNAME record, got ${domainRecords.length}` }
      } else {
        // remove trailing dot if any
        const normalize = s => (s.endsWith('.') ? s.slice(0, -1) : s)
        result.valid = normalize(domainRecords[0]) === normalize(recordValue)
        if (!result.valid) {
          result.error = { message: `CNAME points to ${domainRecords[0]}, expected ${recordValue}` }
        }
      }
    } else {
      result.error = { message: `Invalid DNS record type: ${type}` }
    }
  } catch (error) {
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      result.error = { message: `DNS record not found: ${error.code}` }
    } else {
      result.error = { message: `DNS error: ${error.message}` }
    }
  }

  return result
}

// Detach a certificate from the elb listener
export async function detachDomainCertificate (certificateArn) {
  try {
    await detachCertificateFromElb(certificateArn)
    return { error: null }
  } catch (error) {
    console.error(`Failed to detach certificate from elb: ${error.message}`)
    return { error }
  }
}

// Delete a certificate for a custom domain
export async function deleteDomainCertificate (certificateArn) {
  try {
    await deleteCertificate(certificateArn)
    return { error: null }
  } catch (error) {
    console.error(`Failed to delete certificate: ${error.message}`)
    return { error }
  }
}
