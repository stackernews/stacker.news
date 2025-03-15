import { ACM } from 'aws-sdk'
// TODO: skeleton

const region = 'us-east-1' // cloudfront ACM is in us-east-1
const acm = new ACM({ region })

export async function requestCertificate (domain) {
  const params = {
    DomainName: domain,
    ValidationMethod: 'DNS',
    Tags: [
      {
        Key: 'ManagedBy',
        Value: 'stackernews'
      }
    ]
  }

  const certificate = await acm.requestCertificate(params).promise()
  return certificate.CertificateArn
}

export async function getCertificateStatus (certificateArn) {
  const certificate = await acm.describeCertificate({ CertificateArn: certificateArn }).promise()
  return certificate.Certificate.Status
}
