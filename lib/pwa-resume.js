export const PWA_RESUME_STORAGE_KEY = 'sn:pwa-resume'
export const PWA_RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function isStandalonePWA (win = typeof window === 'undefined' ? null : window) {
  return !!(
    win?.navigator?.standalone === true ||
    win?.matchMedia?.('(display-mode: standalone)')?.matches
  )
}

export function isPWAStartPath (asPath) {
  const [pathAndSearch] = String(asPath || '').split('#')
  const [pathname, search] = pathAndSearch.split('?')
  if (pathname !== '/') return false

  const params = new URLSearchParams(search)
  params.delete('nodata')
  return Array.from(params).length === 0
}

export function isPWAResumePath (asPath) {
  const [pathAndSearch] = String(asPath || '').split('#')
  const [pathname] = pathAndSearch.split('?')
  return /^\/items\/[^/]+$/.test(pathname)
}

export function createPWAResumeEntry (asPath, now = Date.now()) {
  if (!isPWAResumePath(asPath)) return null
  return JSON.stringify({ asPath, ts: now })
}

export function getPWAResumePath (entry, now = Date.now(), maxAge = PWA_RESUME_MAX_AGE_MS) {
  if (!entry) return null

  try {
    const parsed = JSON.parse(entry)
    if (!isPWAResumePath(parsed?.asPath)) return null
    if (typeof parsed?.ts !== 'number') return null
    if (parsed.ts > now || now - parsed.ts > maxAge) return null
    return parsed.asPath
  } catch {
    return null
  }
}
