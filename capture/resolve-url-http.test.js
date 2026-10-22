import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { resolveCaptureUrl } from './resolve-url.js'

async function withServer (handler, run) {
  const server = http.createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    await run(new URL(`http://127.0.0.1:${server.address().port}/`))
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}

test('real HTTP lookup preserves the approved hostname and requested path', async () => {
  await withServer((req, res) => {
    assert.equal(req.url, '/api/capture-domain?domain=example.com')
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ domain: 'example.com' }))
  }, async base => {
    const url = await resolveCaptureUrl('/example.com/items/123?commentId=456', base)
    assert.equal(url.href, 'https://example.com/items/123?commentId=456')
  })
})

test('real HTTP lookup does not follow even a same-server redirect', async () => {
  let redirectedRequests = 0
  await withServer((req, res) => {
    if (req.url.startsWith('/api/capture-domain')) {
      res.writeHead(302, { Location: '/redirected' }).end()
    } else {
      redirectedRequests++
      res.end(JSON.stringify({ domain: 'example.com' }))
    }
  }, async base => {
    await assert.rejects(resolveCaptureUrl('/example.com/items/123', base))
    assert.equal(redirectedRequests, 0)
  })
})

test('real inactive-domain and service-error responses reject navigation', async () => {
  for (const status of [404, 503]) {
    await withServer((_req, res) => res.writeHead(status).end(), async base => {
      await assert.rejects(resolveCaptureUrl('/example.com/items/123', base))
    })
  }
})
