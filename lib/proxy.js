import { HttpsProxyAgent } from 'https-proxy-agent'
import { isOnionHost } from '@/lib/url'

class GatewayAgent extends HttpsProxyAgent {
  async connect (request, options) {
    let response
    request.once('proxyConnect', result => { response = result })
    const socket = await super.connect(request, options)
    if (response.statusCode !== 200) {
      // Wait for super.connect to close the real proxy socket, then discard its
      // replay socket. A truncated refusal body would otherwise hang body reads.
      socket.destroy()
      throw Object.assign(new Error(`Proxy CONNECT failed (${response.statusCode})`), {
        code: [500, 503].includes(response.statusCode) ? 'ERR_PROXY_UNAVAILABLE' : 'ERR_PROXY_TUNNEL'
      })
    }
    return socket
  }
}

export function getAgent ({ hostname, cert, signal }) {
  // Node 22's env-proxy https.Agent can crash when aborted before CONNECT's 200:
  // https://github.com/nodejs/node/pull/64545
  // HttpsProxyAgent also cancels the proxy socket while CONNECT is still pending.
  // Tunnel plain HTTP too: withhold the request until CONNECT succeeds so an
  // abandoned onion POST cannot be forwarded after a slow SOCKS handshake.
  const agent = new GatewayAgent(process.env.HTTPS_PROXY, { signal })
  // These options apply to destination TLS; constructor options apply to the proxy.
  Object.assign(agent.options, {
    ca: cert ? Buffer.from(cert, 'base64') : undefined,
    // The onion address authenticates nodes whose certificate doesn't name it.
    rejectUnauthorized: !(cert && isOnionHost(hostname))
  })
  return agent
}
