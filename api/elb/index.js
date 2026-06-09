import {
  ElasticLoadBalancingV2Client,
  AddListenerCertificatesCommand,
  RemoveListenerCertificatesCommand
} from '@aws-sdk/client-elastic-load-balancing-v2'
import { MockELBv2 } from './mocks'

const ELB_LISTENER_ARN = process.env.ELB_LISTENER_ARN

// Cache the ELB client. The v3 SDK builds a credential provider chain and
// HTTP handler on construction, so reconstructing is costly. This speeds up
// worker.js jobs.
let elbClient
function getElbClient () {
  if (process.env.NODE_ENV === 'development') {
    // mocked elb for local development; cheap to construct, but cached for parity
    elbClient ??= new MockELBv2()
    return elbClient
  }
  elbClient ??= new ElasticLoadBalancingV2Client({ region: 'us-east-1' })
  return elbClient
}

// attach a certificate to the elb listener
async function attachCertificateToElb (certificateArn) {
  const elbv2 = getElbClient()

  // attach the certificate
  // AWS doesn't throw an error if the certificate is already attached to the listener
  await elbv2.send(new AddListenerCertificatesCommand({
    ListenerArn: ELB_LISTENER_ARN,
    Certificates: [{ CertificateArn: certificateArn }]
  }))

  return true
}

// detach a certificate from the elb listener
async function detachCertificateFromElb (certificateArn) {
  const elbv2 = getElbClient()

  // detach the certificate
  // AWS doesn't throw an error if the certificate is not attached to the listener
  await elbv2.send(new RemoveListenerCertificatesCommand({
    ListenerArn: ELB_LISTENER_ARN,
    Certificates: [{ CertificateArn: certificateArn }]
  }))

  return true
}

export { attachCertificateToElb, detachCertificateFromElb }
