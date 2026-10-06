import { MAX_SEARCH_LENGTH } from '@/lib/constants'

const MIN_LENGTH = 2

// '' when the text is too short to search
function toQuery (text) {
  const query = text.trim().slice(0, MAX_SEARCH_LENGTH)
  return query.length >= MIN_LENGTH ? query : ''
}

// what to show in the search panel. there are two modes:
// browse: the text is too short to search
// search: everything else
export function toLookup (scope, text, caret) {
  const query = toQuery(text)

  // if the text is too short to search, return browse mode
  if (!query) return { mode: 'browse' }

  // otherwise return search mode with the query
  return {
    mode: 'search',
    text: query
  }
}
