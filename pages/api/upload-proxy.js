export const config = {
  api: {
    bodyParser: false
  }
}

// Simple server-side proxy for presigned S3 POST uploads.
// This avoids browser CORS/preflight issues in environments like Codespaces.
// Security: restrict target host to the configured media host(s).
export default async function handler (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).end('Method Not Allowed')
    return
  }

  const to = req.query.to
  if (!to) {
    res.status(400).end('missing ?to= param')
    return
  }

  let target
  try {
    target = new URL(Array.isArray(to) ? to[0] : to)
  } catch {
    res.status(400).end('invalid target')
    return
  }

  // Build an allowlist of media hosts we can forward to
  const allowedHosts = new Set()
  if (process.env.NEXT_PUBLIC_MEDIA_DOMAIN) {
    allowedHosts.add(process.env.NEXT_PUBLIC_MEDIA_DOMAIN)
  }
  if (process.env.NEXT_PUBLIC_MEDIA_URL) {
    try { allowedHosts.add(new URL(process.env.NEXT_PUBLIC_MEDIA_URL).host) } catch {}
  }
  if (process.env.MEDIA_URL_DOCKER) {
    try { allowedHosts.add(new URL(process.env.MEDIA_URL_DOCKER).host) } catch {}
  }

  if (!allowedHosts.has(target.host)) {
    res.status(403).end('forbidden target')
    return
  }

  try {
    // Forward the incoming multipart body as-is to S3
    const upstream = await fetch(target.toString(), {
      method: 'POST',
      headers: {
        'content-type': req.headers['content-type']
      },
      body: req,
      // required for streaming request bodies in Node fetch
      duplex: 'half'
    })

    // Mirror status back to client; body content is not used by caller
    const text = await upstream.text().catch(() => '')
    res.status(upstream.status)
    // minimal headers; do not mirror upstream CORS headers
    res.setHeader('Cache-Control', 'no-store')
    res.end(text)
  } catch (e) {
    res.status(502).end('upload proxy error')
  }
}

