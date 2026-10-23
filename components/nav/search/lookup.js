import { MAX_SEARCH_LENGTH } from '@/lib/constants'
import { SCOPES } from '@/lib/search'
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

// the word the caret is in, and where it starts and ends in the text
export function wordAt (text, caret) {
  let start = Math.min(caret, text.length)
  let end = start
  while (start > 0 && /\S/.test(text[start - 1])) start--
  while (end < text.length && /\S/.test(text[end])) end++
  return { start, end, word: text.slice(start, end) }
}

// what to show in the search panel. there are three modes:
// name: the caret is in an @nym or ~territory, only stackers or territories show
// browse: the text is too short to search
// search: everything else
export function toLookup (text, caret) {
  const { start, end, word } = wordAt(text, caret)
  const type = SCOPES.find(({ prefix }) => prefix === word[0])?.type
  if (type) {
    return { mode: 'name', type, prefix: word[0], name: word.slice(1), start, end, key: `name|${word}` }
  }

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

// the chips in words, like 'in ~bitcoin by @k00b'
export function scopeWords ({ sub, user }) {
  return [sub && `in ~${sub}`, user && `by @${user}`].filter(Boolean).join(' ')
}

// what making a stacker or territory a chip does, like 'search in ~bitcoin'
export function scopeHint (item) {
  return `search ${scopeWords({ [item.type]: item.name })}`
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
