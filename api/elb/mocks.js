// mock Load Balancers and Listeners for testing
const mockedElb = {
  loadBalancers: [
    {
      LoadBalancerArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/sndev-lb/1234567890abcdef',
      DNSName: 'sndev-lb.us-east-1.elb.amazonaws.com',
      LoadBalancerName: 'sndev-lb',
      Type: 'application'
    }
  ],
  listeners: [
    {
      ListenerArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/sndev-lb/1234567890abcdef/1234567890abcdef',
      LoadBalancerArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/sndev-lb/1234567890abcdef',
      Protocol: 'HTTPS',
      Port: 443
    }
  ],
  certificates: []
}

// describeLoadBalancers
// return the load balancers that match the names in the params
function describeLoadBalancers ({ Names }) {
  let loadBalancers = [...mockedElb.loadBalancers]

  if (Names && Names.length > 0) {
    loadBalancers = loadBalancers.filter(lb => Names.includes(lb.LoadBalancerName))
  }

  return { LoadBalancers: loadBalancers }
}

// describeListeners
// return the listeners that match the load balancer arn in the params
function describeListeners ({ LoadBalancerArn, Filters }) {
  let listeners = [...mockedElb.listeners]

  if (LoadBalancerArn) {
    listeners = listeners.filter(listener => listener.LoadBalancerArn === LoadBalancerArn)
  }

  if (Filters && Filters.length > 0) {
    Filters.forEach(filter => {
      if (filter.Name === 'protocol' && filter.Values) {
        listeners = listeners.filter(listener =>
          filter.Values.includes(listener.Protocol)
        )
      }
    })
  }

  return { Listeners: listeners }
}

// describeListenerCertificates
// return the certificates that match the listener arn in the params
function describeListenerCertificates ({ ListenerArn }) {
  const certificates = mockedElb.certificates
    .filter(cert => cert.ListenerArn === ListenerArn)
    .map(cert => ({ CertificateArn: cert.CertificateArn }))

  return { Certificates: certificates }
}

// addListenerCertificates
// add the certificates to the mockedElb.certificates
// ELBv2 is idempotent: adding an already-attached certificate is a no-op
function addListenerCertificates ({ ListenerArn, Certificates }) {
  Certificates.forEach(cert => {
    const exists = mockedElb.certificates.some(
      c => c.ListenerArn === ListenerArn && c.CertificateArn === cert.CertificateArn
    )

    if (!exists) {
      mockedElb.certificates.push({
        ListenerArn,
        CertificateArn: cert.CertificateArn
      })
    }
  })

  return {}
}

// removeListenerCertificates
// remove the certificates from the mockedElb.certificates
// ELBv2 is idempotent: removing an absent certificate is a no-op
function removeListenerCertificates ({ ListenerArn, Certificates }) {
  Certificates.forEach(cert => {
    mockedElb.certificates = mockedElb.certificates.filter(
      c => !(c.ListenerArn === ListenerArn && c.CertificateArn === cert.CertificateArn)
    )
  })

  return {}
}

// drop-in for ElasticLoadBalancingV2Client: dispatches v3 Commands via send()
class MockELBv2 {
  async send (command) {
    switch (command?.constructor?.name) {
      case 'DescribeLoadBalancersCommand':
        return describeLoadBalancers(command.input)
      case 'DescribeListenersCommand':
        return describeListeners(command.input)
      case 'DescribeListenerCertificatesCommand':
        return describeListenerCertificates(command.input)
      case 'AddListenerCertificatesCommand':
        return addListenerCertificates(command.input)
      case 'RemoveListenerCertificatesCommand':
        return removeListenerCertificates(command.input)
      default:
        throw new Error(`MockELBv2: unsupported command ${command?.constructor?.name}`)
    }
  }
}

export { MockELBv2, mockedElb }
