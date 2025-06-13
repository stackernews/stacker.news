import AWS from 'aws-sdk'

const config = {
  region: 'us-east-1',
  // for local development, we use the LOCALSTACK_ENDPOINT
  endpoint: process.env.NODE_ENV === 'development' ? process.env.LOCALSTACK_ENDPOINT : undefined
}

export async function requestCertificate (domain) {
  const acm = new AWS.ACM(config)
  const params = {
    DomainName: domain,
    ValidationMethod: 'DNS',
    Tags: [
      {
        Key: 'ManagedBy',
        Value: 'stacker.news'
      }
    ]
  }

  const certificate = await acm.requestCertificate(params).promise()
  return certificate.CertificateArn
}

export async function describeCertificate (certificateArn) {
  const acm = new AWS.ACM(config)
  const certificate = await acm.describeCertificate({ CertificateArn: certificateArn }).promise()
  return certificate
}

export async function getCertificateStatus (certificateArn) {
  const certificate = await describeCertificate(certificateArn)
  return certificate.Certificate.Status
}

export async function deleteCertificate (certificateArn) {
  const acm = new AWS.ACM(config)
  const result = await acm.deleteCertificate({ CertificateArn: certificateArn }).promise()
  return result
}
