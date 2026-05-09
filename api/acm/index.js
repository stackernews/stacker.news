import {
  ACMClient,
  RequestCertificateCommand,
  DescribeCertificateCommand,
  DeleteCertificateCommand
} from '@aws-sdk/client-acm'

const config = {
  region: 'us-east-1',
  // for local development, we use the LOCALSTACK_ENDPOINT
  endpoint: process.env.NODE_ENV === 'development' ? process.env.LOCALSTACK_ENDPOINT : undefined
}

export async function requestCertificate (domain, idempotencyToken) {
  const client = new ACMClient(config)
  const params = {
    DomainName: domain,
    ValidationMethod: 'DNS',
    IdempotencyToken: String(idempotencyToken),
    Tags: [
      {
        Key: 'ManagedBy',
        Value: 'stacker.news'
      }
    ]
  }

  const certificate = await client.send(new RequestCertificateCommand(params))
  return certificate.CertificateArn
}

export async function describeCertificate (certificateArn) {
  const client = new ACMClient(config)
  const certificate = await client.send(new DescribeCertificateCommand({ CertificateArn: certificateArn }))
  return certificate
}

export async function getCertificateStatus (certificateArn) {
  const certificate = await describeCertificate(certificateArn)
  return certificate.Certificate.Status
}

export async function deleteCertificate (certificateArn) {
  const client = new ACMClient(config)
  const result = await client.send(new DeleteCertificateCommand({ CertificateArn: certificateArn }))
  return result
}
