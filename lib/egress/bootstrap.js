import http from 'node:http'
import diagnostics from 'node:diagnostics_channel'

// Every client uses the same explicit host:port, without URL normalization.
const uri = process.env.HTTPS_PROXY
if (!/^http:\/\/[A-Za-z0-9._-]+:\d+$/.test(uri) || !URL.canParse(uri)) throw new Error('HTTPS_PROXY must be an http://host:port proxy URL with an ASCII hostname, without credentials or a path')
// Inspect the startup snapshot, not env files loaded after Node initialized its agents.
const env = http.globalAgent.options.proxyEnv
// Native fetch also reads NO_PROXY at request time, after env files may have loaded.
if (!env || (env.http_proxy ?? env.HTTP_PROXY) !== uri || (env.https_proxy ?? env.HTTPS_PROXY) !== uri || env.no_proxy || env.NO_PROXY || process.env.no_proxy || process.env.NO_PROXY || process.env.no_grpc_proxy) {
  throw new Error('Start Node with NODE_USE_ENV_PROXY=1, matching HTTP_PROXY/HTTPS_PROXY (and http_proxy/https_proxy if set), and no NO_PROXY or no_grpc_proxy bypasses')
}
// Node 22 rewrites grpc-js's CONNECT authority when the default HTTP agent proxies
// it again. Upstream excludes CONNECT from rewriting in this fix (absent in 22.23.5):
// https://github.com/nodejs/node/pull/64108
// Node 24 backport: https://github.com/nodejs/node/commit/592544af448f
// AWS SDK instance-role credential lookup also relies on this direct default agent
// to reach EC2 metadata (IMDS). Preserve that access when removing the gRPC workaround.
// Ordinary HTTP requests must use snFetch or an explicit proxy agent.
http.globalAgent = new http.Agent({ keepAlive: true, timeout: 5000 })

// grpc-js through 1.14.7 leaves refused CONNECT sockets open, risking leaks and
// uncaught reset errors. Remove this when upstream fixes cleanup. It closes all
// explicit http.request CONNECT refusals, discarding their response bodies.
// EventEmitter still runs this handler if grpc-js removes listeners mid-emit.
// The HTTP diagnostics channel is documented but experimental:
// https://nodejs.org/docs/latest-v22.x/api/diagnostics_channel.html#http
diagnostics.subscribe('http.client.request.start', ({ request }) => {
  if (request.method !== 'CONNECT' || !request.listenerCount('connect')) return
  const timer = setTimeout(() => request.destroy(), 30_000).unref()
  const clearDeadline = () => clearTimeout(timer)
  request.once('close', clearDeadline)
  // grpc-js removes the request listeners in its connect and error handlers,
  // so clear the deadline during those events, before the subsequent close.
  request.once('error', clearDeadline)
  request.once('connect', (res, socket) => {
    clearDeadline()
    if (res.statusCode !== 200) socket.destroy()
  })
})
process.env.grpc_proxy = uri
