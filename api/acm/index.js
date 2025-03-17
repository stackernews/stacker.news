import AWS from 'aws-sdk'
// TODO: boilerplate

AWS.config.update({
  region: 'us-east-1'
})

const config = {
  s3ForcePathStyle: process.env.NODE_ENV === 'development'
}

export async function requestCertificate (domain) {
  // for local development, we use the LOCALSTACK_ENDPOINT which
  // is reachable from the host machine
  if (process.env.NODE_ENV === 'development') {
    config.endpoint = process.env.LOCALSTACK_ENDPOINT
  }

  const acm = new AWS.ACM(config)
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

export async function describeCertificate (certificateArn) {
  // for local development, we use the LOCALSTACK_ENDPOINT which
  // is reachable from the host machine
  if (process.env.NODE_ENV === 'development') {
    config.endpoint = process.env.LOCALSTACK_ENDPOINT
  }
  const acm = new AWS.ACM(config)
  const certificate = await acm.describeCertificate({ CertificateArn: certificateArn }).promise()
  return certificate
}

export async function getCertificateStatus (certificateArn) {
  const certificate = await describeCertificate(certificateArn)
  return certificate.Certificate.Status
}
