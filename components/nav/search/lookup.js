import { MAX_SEARCH_LENGTH } from '@/lib/constants'
import { useState, useEffect } from 'react'

// the delay before the lookup is executed
const DEBOUNCE_MS = 500
// the minimum length of the text to search
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
    text: query,
    nameQ: nameWords(query),
    key: `search|${query}`
  }
}

// the words that could be the name of a stacker or territory
function nameWords (text) {
  return text.replace(/"/g, '').split(/\s+/).filter(word => word && !/^([@~]|url:)/.test(word)).join(' ')
}

// the lookup after a pause in typing, the queries use this one
export function useDebouncedLookup (lookup) {
  const [debounced, setDebounced] = useState(lookup)
  useEffect(() => {
    // don't wait when there's nothing to look up
    if (lookup.mode === 'browse') {
      setDebounced(lookup)
      return
    }
    const timeout = setTimeout(() => setDebounced(lookup), DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [lookup.key])
  return debounced
}
