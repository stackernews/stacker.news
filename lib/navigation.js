import { subNamesFromSlug } from './subs'

const territoryPrefix = /^\/~[^/]+/
const analyticsPath = /^\/stackers\/([^/]+)\/([^/]+)\/?$/

export function navSubFromPath (asPath, sub, activeSubs = []) {
  const path = asPath.split(/[?#]/)[0]
  const analyticsSub = path.match(analyticsPath)?.[1]
  const slug = path.match(territoryPrefix)?.[0].slice(2) || (analyticsSub !== 'all' ? analyticsSub : undefined)
  if (!slug) return undefined

  try {
    const names = subNamesFromSlug(decodeURIComponent(slug))
    if (names.length !== 1) return undefined
    const name = names[0]
    return [sub, ...activeSubs.map(s => s.name)].find(s => s?.toLowerCase() === name.toLowerCase()) || name
  } catch {
    return undefined
  }
}

export function navKeys (asPath, branded = false) {
  const path = asPath.split(/[?#]/)[0]
  const offset = !branded && territoryPrefix.test(path) ? 2 : 1
  const segments = path.split('/')
  return {
    topNavKey: segments[offset] ?? '',
    dropNavKey: segments.slice(offset).join('/')
  }
}

export function territoryHref (asPath, selectedSub, { canEdit = false } = {}) {
  if (selectedSub === 'create') return '/territory'
  const sub = ['home', 'pick territory'].includes(selectedSub) ? undefined : selectedSub
  const prefix = sub ? `/~${sub}` : ''
  const url = new URL(asPath, 'https://stacker.news')
  // Route context comes from the pathname, not query parameters.
  url.searchParams.delete('sub')
  url.searchParams.delete('nodata')
  const analytics = url.pathname.match(analyticsPath)
  if (analytics) return `/stackers/${sub || 'all'}/${analytics[2]}${url.search}${url.hash}`

  const scoped = territoryPrefix.test(url.pathname)
  const path = url.pathname.replace(territoryPrefix, '') || '/'

  if (scoped && /^\/edit\/?$/.test(path)) {
    if (!sub || !canEdit) return prefix || '/'
  } else if (/^\/top\/(cowboys|stackers|territories)(\/|$)/.test(path)) {
    if (sub) return `${prefix}/top/posts/day`
  } else if (!/^\/(?:$|(?:new|top)(?:\/|$)|(?:post|rss)\/?$)/.test(path)) {
    return prefix || '/'
  }

  return `${prefix}${path === '/' && prefix ? '' : path}${url.search}${url.hash}`
}
