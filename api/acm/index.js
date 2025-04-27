import AWS from 'aws-sdk'

AWS.config.update({
  region: 'us-east-1'
})

const config = {}

export async function requestCertificate (domain) {
  // for local development, we use the LOCALSTACK_ENDPOINT
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
        Value: 'stacker.news'
      }
    ]
  }

  const certificate = await acm.requestCertificate(params).promise()
  return certificate.CertificateArn
}

export async function describeCertificate (certificateArn) {
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

export async function deleteCertificate (certificateArn) {
  if (process.env.NODE_ENV === 'development') {
    config.endpoint = process.env.LOCALSTACK_ENDPOINT
  }
  const acm = new AWS.ACM(config)
  const result = await acm.deleteCertificate({ CertificateArn: certificateArn }).promise()
  console.log(`delete certificate attempt for ${certificateArn}, result: ${JSON.stringify(result)}`)
  return result
}
