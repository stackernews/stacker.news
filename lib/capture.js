// The capture service screenshots a path and serves it as the og:image. It knows two
// kinds of origin: the main site, and the ACTIVE custom domains the app vouches for
// (see pages/api/capture/domains.js). Prefixing the path with a custom domain is what
// makes the preview render with the territory's own branding instead of SN's.

export const CAPTURE_URL = process.env.NEXT_PUBLIC_CAPTURE_URL || 'https://capture.stacker.news'

/** @param {{ path: string, branding: object|null }} args */
export function capturePath ({ path, branding }) {
  // custom domain paths are already domain-local, proxy.js stripped the ~sub
  const prefix = branding?.domainName
    ? `/${branding.domainName}`
    // no domain resolved: fall back to the territory page on the main site
    : branding?.subName ? `/~${branding.subName}` : ''

  if (!prefix) return path
  return path === '/' ? prefix : `${prefix}${path}`
}

/** @param {{ path: string, branding: object|null }} args */
export function captureUrl ({ path, branding }) {
  return CAPTURE_URL + capturePath({ path, branding })
}
