import { requestCertificate, getCertificateStatus, describeCertificate, deleteCertificate } from '@/api/acm'
import { detachCertificateFromElb, attachCertificateToElb } from '@/api/elb'
import { Resolver } from 'node:dns/promises'

// Issue a certificate for a custom domain
export async function issueDomainCertificate (domainName) {
  try {
    const certificateArn = await requestCertificate(domainName)
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

// Get the validation values for a certificate for a custom domain
export async function getValidationValues (certificateArn) {
  const { certificate, error } = await certDetails(certificateArn)
  if (error) {
    return { cname: null, value: null, error }
  }

  if (!certificate || !certificate.Certificate || !certificate.Certificate.DomainValidationOptions) {
    return { cname: null, value: null, error: { message: 'Certificate not found' } }
  }

  return {
    cname: certificate.Certificate.DomainValidationOptions[0]?.ResourceRecord?.Name || null,
    value: certificate.Certificate.DomainValidationOptions[0]?.ResourceRecord?.Value || null
  }
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
      // remove trailing dot if any
      const normalize = s => (s.endsWith('.') ? s.slice(0, -1) : s)
      result.valid = domainRecords.some(record =>
        normalize(record) === normalize(recordValue)
      )
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
