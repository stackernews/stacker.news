import AWS from 'aws-sdk'
import { MockELBv2 } from './mocks'

AWS.config.update({
  region: 'us-east-1'
})

async function getElb () {
  try {
    // get the load balancer
    const elbv2 = process.env.NODE_ENV === 'development'
      ? new MockELBv2() // use the mocked elb for local development
      : new AWS.ELBv2()
    const { LoadBalancers } = await elbv2.describeLoadBalancers({ Names: [process.env.ELB_NAME] }).promise()
    console.log('[elbv2] LoadBalancers', LoadBalancers)

    if (!LoadBalancers?.length) {
      throw new Error('Cannot find a load balancer, check the .env file')
    }

    return LoadBalancers[0]
  } catch (error) {
    console.error('[elbv2] Error getting elb', error)
    throw error
  }
}

async function getElbListener (elbArn) {
  try {
    const elbv2 = process.env.NODE_ENV === 'development'
      ? new MockELBv2() // use the mocked elb for local development
      : new AWS.ELBv2()
    const { Listeners } = await elbv2.describeListeners({ LoadBalancerArn: elbArn, Filters: [{ Name: 'protocol', Values: ['HTTPS'] }] }).promise()
    console.log('[elbv2] Listeners', Listeners)

    if (!Listeners?.length) {
      throw new Error('Cannot find a listener, check the .env file')
    }

    return Listeners[0]
  } catch (error) {
    console.error('[elbv2] Error getting elb listener', error)
    throw error
  }
}

// attach a certificate to the elb listener
async function attachCertificateToElb (certificateArn) {
  const elbv2 = process.env.NODE_ENV === 'development'
    ? new MockELBv2() // use the mocked elb for local development
    : new AWS.ELBv2()
  const elb = await getElb()
  const elbListener = await getElbListener(elb.LoadBalancerArn)
  const elbListenerArn = elbListener.ListenerArn

  // attach the certificate
  // AWS doesn't throw an error if the certificate is already attached to the listener
  await elbv2.addListenerCertificates({
    ListenerArn: elbListenerArn,
    Certificates: [{ CertificateArn: certificateArn }]
  }).promise()

  console.log('[elbv2] Certificate', certificateArn, 'attached to listener', elbListenerArn)
  return true
}

// detach a certificate from the elb listener
async function detachCertificateFromElb (certificateArn) {
  const elbv2 = process.env.NODE_ENV === 'development'
    ? new MockELBv2() // use the mocked elb for local development
    : new AWS.ELBv2()
  const elb = await getElb()
  const elbListener = await getElbListener(elb.LoadBalancerArn)
  const elbListenerArn = elbListener.ListenerArn

  // detach the certificate
  // AWS doesn't throw an error if the certificate is not attached to the listener
  await elbv2.removeListenerCertificates({
    ListenerArn: elbListenerArn,
    Certificates: [{ CertificateArn: certificateArn }]
  }).promise()

  console.log('[elbv2] Certificate', certificateArn, 'detached from listener', elbListenerArn)
  return true
}

/* // check if a certificate is attached to the elb listener
async function isCertificateAttachedToElb (listenerArn, certificateArn) {
  const elbv2 = process.env.NODE_ENV === 'development'
    ? new MockELBv2() // use the mocked elb for local development
    : new AWS.ELBv2()
  const { Certificates } = await elbv2.describeListenerCertificates({ ListenerArn: listenerArn }).promise()
  const found = Certificates.some(certificate => certificate.CertificateArn === certificateArn)
  if (!found) {
    return false
  }
  return true
} */

export { attachCertificateToElb, detachCertificateFromElb }
