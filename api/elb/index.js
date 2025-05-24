import AWS from 'aws-sdk'
import { MockELBv2 } from './mocks'

const ELB_LISTENER_ARN = process.env.ELB_LISTENER_ARN

AWS.config.update({
  region: 'us-east-1'
})

// attach a certificate to the elb listener
async function attachCertificateToElb (certificateArn) {
  const elbv2 = process.env.NODE_ENV === 'development'
    ? new MockELBv2() // use the mocked elb for local development
    : new AWS.ELBv2()

  // attach the certificate
  // AWS doesn't throw an error if the certificate is already attached to the listener
  await elbv2.addListenerCertificates({
    ListenerArn: ELB_LISTENER_ARN,
    Certificates: [{ CertificateArn: certificateArn }]
  }).promise()

  console.log('[elbv2] Certificate', certificateArn, 'attached to listener', ELB_LISTENER_ARN)
  return true
}

// detach a certificate from the elb listener
async function detachCertificateFromElb (certificateArn) {
  const elbv2 = process.env.NODE_ENV === 'development'
    ? new MockELBv2() // use the mocked elb for local development
    : new AWS.ELBv2()

  // detach the certificate
  // AWS doesn't throw an error if the certificate is not attached to the listener
  await elbv2.removeListenerCertificates({
    ListenerArn: ELB_LISTENER_ARN,
    Certificates: [{ CertificateArn: certificateArn }]
  }).promise()

  console.log('[elbv2] Certificate', certificateArn, 'detached from listener', ELB_LISTENER_ARN)
  return true
}

export { attachCertificateToElb, detachCertificateFromElb }
