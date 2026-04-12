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

// mock AWS.ELBv2 class
class MockELBv2 {
  // mock describeLoadBalancers
  // return the load balancers that match the names in the params
  describeLoadBalancers (params) {
    const { Names } = params
    let loadBalancers = [...mockedElb.loadBalancers]

    if (Names && Names.length > 0) {
      loadBalancers = loadBalancers.filter(lb => Names.includes(lb.LoadBalancerName))
    }

    return {
      promise: () => Promise.resolve({ LoadBalancers: loadBalancers })
    }
  }

  // mock describeListeners
  // return the listeners that match the load balancer arn in the params
  describeListeners (params) {
    const { LoadBalancerArn, Filters } = params
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

    return {
      promise: () => Promise.resolve({ Listeners: listeners })
    }
  }

  // mock describeListenerCertificates
  // return the certificates that match the listener arn in the params
  describeListenerCertificates (params) {
    const { ListenerArn } = params
    const certificates = mockedElb.certificates
      .filter(cert => cert.ListenerArn === ListenerArn)
      .map(cert => ({ CertificateArn: cert.CertificateArn }))

    return {
      promise: () => Promise.resolve({ Certificates: certificates })
    }
  }

  // mock addListenerCertificates
  // add the certificates to the mockedElb.certificates
  addListenerCertificates (params) {
    const { ListenerArn, Certificates } = params

    Certificates.forEach(cert => {
      // ELBv2 checks if the certificate is already attached to the listener
      // and doesn't add it again if it is
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

    return {
      promise: () => Promise.resolve({})
    }
  }

  // mock removeListenerCertificates
  // remove the certificates from the mockedElb.certificates
  // AWS doesn't throw an error if the certificate is not attached to the listener
  removeListenerCertificates (params) {
    const { ListenerArn, Certificates } = params

    Certificates.forEach(cert => {
      mockedElb.certificates = mockedElb.certificates.filter(
        c => !(c.ListenerArn === ListenerArn && c.CertificateArn === cert.CertificateArn)
      )
    })

    return {
      promise: () => Promise.resolve({})
    }
  }
}

export { MockELBv2, mockedElb }
