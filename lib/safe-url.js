function isSafeRedirectPath (uri) {
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
