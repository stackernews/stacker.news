export const FULL_TEXT_QUERY_PARAM = 'fullText'

export function fullTextAsPath (asPath, itemId) {
  if (!itemId) return asPath

  const [pathAndSearch, hash] = asPath.split('#')
  const [pathname, search] = pathAndSearch.split('?')
  const params = new URLSearchParams(search)
  params.set(FULL_TEXT_QUERY_PARAM, String(itemId))

  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`
}

export function isFullTextItemPath (asPath, itemId) {
  if (!itemId) return false

  const [pathAndSearch] = asPath.split('#')
  const [, search] = pathAndSearch.split('?')
  const params = new URLSearchParams(search)

  return params.get(FULL_TEXT_QUERY_PARAM) === String(itemId)
}

export function shouldShowFullTextForPath (asPath, itemId) {
  return asPath.includes('#') || isFullTextItemPath(asPath, itemId)
}
