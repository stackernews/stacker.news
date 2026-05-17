const isProd = process.env.NODE_ENV === 'production'

// True iff the current request was served over HTTPS. In prod this is always
// true (the ALB terminates TLS). In dev it depends on whether the request
// came in via a TLS-terminating proxy (https) or directly to localhost:3000
// (http) — used to gate the Secure cookie attribute so localhost dev still
// works while the custom-domain HTTPS path exercises the full secure-cookie
// codepath.
//
// Accepts either an edge NextRequest, a Node IncomingMessage, or undefined.
// When called in the browser with no req, derives from window.location.
export function isSecureRequest (req) {
  if (isProd) return true
  if (!req) {
    if (typeof window !== 'undefined') return window.location.protocol === 'https:'
    return false
  }
  // X-Forwarded-Proto wins: it's the authoritative client protocol when a
  // TLS-terminating proxy (Caddy/external LB in dev, ALB in prod) is in
  // front. On edge NextRequest, req.nextUrl.protocol reflects the inbound hop
  // to the app (plain http behind Caddy), so we must consult the header first.
  const headers = req.headers
  const xfp = typeof headers?.get === 'function' ? headers.get('x-forwarded-proto') : headers?.['x-forwarded-proto']
  if (xfp) return xfp === 'https'
  // No proxy in front: fall back to the actual inbound protocol (edge only;
  // bare Node IncomingMessage has no equivalent and stays false).
  if (req.nextUrl?.protocol) return req.nextUrl.protocol === 'https:'
  return false
}

export function isSafeRedirectPath (uri) {
  if (typeof uri !== 'string' || uri.length === 0) return false
  if (uri[0] !== '/') return false
  if (uri[1] === '/' || uri[1] === '\\') return false
  try {
    // arbitrarily resolve against the main domain. if the origin changes, it's unsafe
    const base = process.env.NEXT_PUBLIC_URL
    return new URL(uri, base).origin === base
  } catch {
    return false
  }
}

export function parseSafeHost (host) {
  if (typeof host !== 'string') return null

  const raw = host.trim()
  if (!raw || raw !== host) return null
  if (/[/?#\\@]/.test(raw)) return null

  try {
    const url = new URL(`http://${raw}`)
    // e.g. https://active-domain.com:443@evil.com is rejected
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    if (!url.hostname) return null

    return {
      hostname: url.hostname.toLowerCase(),
      port: url.port || null
    }
  } catch {
    return null
  }
}

export function formatHost ({ hostname, port }) {
  return port ? `${hostname}:${port}` : hostname
}

export function safeRedirectPath (uri, allowedHost) {
  if (!uri) return '/'
  if (isSafeRedirectPath(uri)) return uri

  const parsedAllowedHost = parseSafeHost(allowedHost)
  if (!parsedAllowedHost) return '/'

  try {
    const parsedUri = new URL(uri)
    const parsedUriHost = parseSafeHost(parsedUri.host)
    // Absolute URLs are accepted only when they target the same canonical host.
    // We return only the path so callers redirect on their own current origin.
    if (parsedUriHost && formatHost(parsedUriHost) === formatHost(parsedAllowedHost)) {
      return (parsedUri.pathname || '/') + parsedUri.search + parsedUri.hash
    }
  } catch {}

  return '/'
}

export function getRequestOrigin (req) {
  const parsed = parseSafeHost(req?.headers?.host)
  if (!parsed) return null

  const protocol = isSecureRequest(req) ? 'https' : 'http'
  return `${protocol}://${formatHost(parsed)}`
}
