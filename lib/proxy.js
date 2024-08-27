import http from 'http'
import https from 'https'
import { TOR_REGEXP } from '@/lib/url'

// from https://github.com/delvedor/hpagent

export class HttpProxyAgent extends http.Agent {
  constructor (options) {
    const { proxy, proxyRequestOptions, ...opts } = options
    super(opts)
    this.proxy = typeof proxy === 'string'
      ? new URL(proxy)
      : proxy
    this.proxyRequestOptions = proxyRequestOptions || {}
  }

  createConnection (options, callback) {
    const requestOptions = {
      ...this.proxyRequestOptions,
      method: 'CONNECT',
      host: this.proxy.hostname,
      port: this.proxy.port,
      path: `${options.host}:${options.port}`,
      setHost: false,
      headers: { ...this.proxyRequestOptions.headers, connection: this.keepAlive ? 'keep-alive' : 'close', host: `${options.host}:${options.port}` },
      agent: false,
      timeout: options.timeout || 0
    }

    if (this.proxy.username || this.proxy.password) {
      const base64 = Buffer.from(`${decodeURIComponent(this.proxy.username || '')}:${decodeURIComponent(this.proxy.password || '')}`).toString('base64')
      requestOptions.headers['proxy-authorization'] = `Basic ${base64}`
    }

    if (this.proxy.protocol === 'https:') {
      requestOptions.servername = this.proxy.hostname
    }

    const request = (this.proxy.protocol === 'http:' ? http : https).request(requestOptions)
    request.once('connect', (response, socket, head) => {
      request.removeAllListeners()
      socket.removeAllListeners()
      if (response.statusCode === 200) {
        callback(null, socket)
      } else {
        socket.destroy()
        callback(new Error(`Bad response: ${response.statusCode}`), null)
      }
    })

    request.once('timeout', () => {
      request.destroy(new Error('Proxy timeout'))
    })

    request.once('error', err => {
      request.removeAllListeners()
      callback(err, null)
    })

    request.end()
  }
}

export class HttpsProxyAgent extends https.Agent {
  constructor (options) {
    const { proxy, proxyRequestOptions, ...opts } = options
    super(opts)
    this.proxy = typeof proxy === 'string'
      ? new URL(proxy)
      : proxy
    this.proxyRequestOptions = proxyRequestOptions || {}
  }

  createConnection (options, callback) {
    const requestOptions = {
      ...this.proxyRequestOptions,
      method: 'CONNECT',
      host: this.proxy.hostname,
      port: this.proxy.port,
      path: `${options.host}:${options.port}`,
      setHost: false,
      headers: { ...this.proxyRequestOptions.headers, connection: this.keepAlive ? 'keep-alive' : 'close', host: `${options.host}:${options.port}` },
      agent: false,
      timeout: options.timeout || 0
    }

    if (this.proxy.username || this.proxy.password) {
      const base64 = Buffer.from(`${decodeURIComponent(this.proxy.username || '')}:${decodeURIComponent(this.proxy.password || '')}`).toString('base64')
      requestOptions.headers['proxy-authorization'] = `Basic ${base64}`
    }

    // Necessary for the TLS check with the proxy to succeed.
    if (this.proxy.protocol === 'https:') {
      requestOptions.servername = this.proxy.hostname
    }

    const request = (this.proxy.protocol === 'http:' ? http : https).request(requestOptions)
    request.once('connect', (response, socket, head) => {
      request.removeAllListeners()
      socket.removeAllListeners()
      if (response.statusCode === 200) {
        const secureSocket = super.createConnection({ ...options, socket })
        callback(null, secureSocket)
      } else {
        socket.destroy()
        callback(new Error(`Bad response: ${response.statusCode}`), null)
      }
    })

    request.once('timeout', () => {
      request.destroy(new Error('Proxy timeout'))
    })

    request.once('error', err => {
      request.removeAllListeners()
      callback(err, null)
    })

    request.end()
  }
}

export function getAgent ({ hostname, cert }) {
  let agent

  const httpsAgentOptions = { ca: cert ? Buffer.from(cert, 'base64') : undefined }

  const isOnion = TOR_REGEXP.test(hostname)
  if (isOnion) {
    // we support HTTP and HTTPS over Tor
    const protocol = cert ? 'https:' : 'http:'
    // we need to use our Tor proxy to resolve onion addresses
    const proxyOptions = { proxy: process.env.TOR_PROXY }
    agent = protocol === 'https:'
      ? new HttpsProxyAgent({ ...proxyOptions, ...httpsAgentOptions, rejectUnauthorized: false })
      : new HttpProxyAgent(proxyOptions)
    return agent
  }

  if (process.env.NODE_ENV === 'development' && !cert) {
    return new http.Agent()
  }

  // we only support HTTPS over clearnet
  return new https.Agent(httpsAgentOptions)
}
