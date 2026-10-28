// Resolves an incoming capture request to the exact URL the headless browser may
// navigate to. This is the security boundary of the service: capture is public and
// runs a browser on SN's infra, so the set of reachable origins is a hard allowlist
// — the configured main domain, plus the ACTIVE custom domains the app hands us.

export function isAssetPath (pathname) {
  return pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/sw.js' ||
    pathname === '/robots.txt' ||
    pathname === '/manifest.json' ||
    pathname === '/site.webmanifest' ||
    pathname === '/api/site.webmanifest' ||
    /\/(?:favicon[^/]*|apple-touch-icon[^/]*)$/.test(pathname)
}

/**
 * @param {object} options
 * @param {string} options.originalUrl - express req.originalUrl, always a path
 * @param {URL} options.baseUrl - the main domain (CAPTURE_URL)
 * @param {Set<string>|null} options.allowedDomains - ACTIVE custom domains, null when unknown
 * @param {string} [options.protocol='https'] - scheme to use for custom domains
 * @returns {{ url: URL, domain: string|null } | { status: number }}
 */
export function resolveCaptureTarget ({ originalUrl, baseUrl, allowedDomains, protocol = 'https' }) {
  if (typeof originalUrl !== 'string' || !originalUrl.startsWith('/')) return { status: 400 }

  let url
  try {
    url = new URL(originalUrl, baseUrl)
  } catch {
    return { status: 400 }
  }

  // protocol-relative paths ("//evil.com/x", and the "/\evil.com/x" the URL parser
  // normalizes to the same thing) resolve away from the base origin
  if (url.origin !== baseUrl.origin) return { status: 400 }

  // settled before the hostname heuristic below, because /site.webmanifest and
  // /favicon.ico carry a dot in their first segment
  if (isAssetPath(url.pathname)) return { status: 404 }

  // hostnames always have a dot; usernames ([\w_]+), territory paths and every
  // top-level SN route never do
  const segment = url.pathname.split('/')[1] ?? ''
  if (!segment.includes('.')) return { url, domain: null }

  // without an allowlist we cannot prove the domain is one of ours: better to have
  // the caller retry than to answer (and let a crawler cache) something wrong
  if (!allowedDomains) return { status: 503 }

  const domain = segment.toLowerCase()
  if (!allowedDomains.has(domain)) return { status: 400 }

  const pathname = url.pathname.slice(segment.length + 1) || '/'
  if (isAssetPath(pathname)) return { status: 404 }

  let target
  try {
    target = new URL(pathname + url.search, `${protocol}://${domain}`)
  } catch {
    return { status: 400 }
  }

  // belt and braces: the allowlist entry is the only thing allowed to shape the origin
  if (target.hostname !== domain || target.port || target.username || target.password) {
    return { status: 400 }
  }

  return { url: target, domain }
}
