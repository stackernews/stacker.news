export class CaptureUrlError extends Error {
  constructor (message, status) {
    super(message)
    this.status = status
  }
}

// The main application is the authority for active custom domains. Never use
// the requested hostname as the lookup endpoint or follow lookup redirects.
export async function resolveCaptureUrl (originalUrl, baseUrl, fetcher = fetch) {
  let url
  try {
    url = new URL(originalUrl, baseUrl)
  } catch {
    throw new CaptureUrlError('invalid capture URL', 400)
  }
  if (url.origin !== baseUrl.origin) throw new CaptureUrlError('invalid capture origin', 400)

  const segments = url.pathname.split('/')
  const domain = segments[1]
  if (!domain.includes('.')) return url
  if (!/^[a-z0-9.-]+$/i.test(domain)) throw new CaptureUrlError('invalid capture domain', 400)

  const lookup = new URL('/api/capture-domain', baseUrl)
  lookup.searchParams.set('domain', domain)
  let response
  try {
    response = await fetcher(lookup, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000)
    })
  } catch {
    throw new CaptureUrlError('capture domain lookup failed', 503)
  }
  if (!response.ok) {
    throw new CaptureUrlError('capture domain unavailable', response.status === 404 ? 400 : 503)
  }
  let mapping
  try {
    mapping = await response.json()
  } catch {
    throw new CaptureUrlError('invalid domain lookup response', 503)
  }
  if (mapping?.domain !== domain.toLowerCase()) throw new CaptureUrlError('invalid domain mapping', 503)

  const target = new URL(`https://${mapping.domain}`)
  target.pathname = '/' + segments.slice(2).join('/')
  target.search = url.search
  return target
}
