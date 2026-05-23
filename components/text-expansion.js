export const SHOW_FULL_TEXT_QUERY_PARAM = 'showFullText'

function normalizeQueryValue (value) {
  if (Array.isArray(value)) return value
  if (value === undefined) return []
  return [value]
}

export function isTextExpandedInQuery (queryValue, itemId) {
  if (!itemId) return false
  const id = String(itemId)
  return normalizeQueryValue(queryValue).map(String).includes(id)
}

export function addTextExpansionToQuery (query, itemId) {
  if (!itemId) return query

  const id = String(itemId)
  const existing = normalizeQueryValue(query[SHOW_FULL_TEXT_QUERY_PARAM]).map(String)
  const nextValue = Array.from(new Set([...existing, id]))

  return {
    ...query,
    [SHOW_FULL_TEXT_QUERY_PARAM]: nextValue.length === 1 ? nextValue[0] : nextValue
  }
}
