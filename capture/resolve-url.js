// The main application is the authority for active custom domains. Never use
// the requested hostname as the lookup endpoint or follow lookup redirects.
export async function resolveCaptureUrl (originalUrl, baseUrl, fetcher = fetch) {
  const url = new URL(originalUrl, baseUrl)
  if (url.origin !== baseUrl.origin) throw new Error('invalid capture origin')

  const segments = url.pathname.split('/')
  const domain = segments[1]
  if (!domain.includes('.')) return url
  if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error('invalid capture domain')

  const lookup = new URL('/api/capture-domain', baseUrl)
  lookup.searchParams.set('domain', domain)
  const response = await fetcher(lookup, {
    redirect: 'error',
    signal: AbortSignal.timeout(5000)
  })
  if (!response.ok) throw new Error('capture domain unavailable')
  const mapping = await response.json()
  if (mapping.domain !== domain.toLowerCase()) throw new Error('invalid domain mapping')

  const target = new URL(`https://${mapping.domain}`)
  target.pathname = '/' + segments.slice(2).join('/')
  target.search = url.search
  return target
}
