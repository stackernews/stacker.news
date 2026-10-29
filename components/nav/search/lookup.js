import { MAX_SEARCH_LENGTH } from '@/lib/constants'
import { SCOPES } from '@/lib/search'

const MIN_LENGTH = 2

function toQuery (text) {
  const query = text.trim().slice(0, MAX_SEARCH_LENGTH)
  return query.length >= MIN_LENGTH ? query : ''
}

export function wordAt (text, caret) {
  let start = Math.min(caret, text.length)
  let end = start
  while (start > 0 && /\S/.test(text[start - 1])) start--
  while (end < text.length && /\S/.test(text[end])) end++
  return { start, end, word: text.slice(start, end) }
}

export function toLookup (text, caret) {
  const { start, end, word } = wordAt(text, caret)
  const type = SCOPES.find(({ prefix }) => prefix === word[0])?.type
  if (type) {
    return { mode: 'name', type, prefix: word[0], name: word.slice(1), start, end, key: `name|${word}` }
  }

  const query = toQuery(text)
  if (!query) return { mode: 'browse' }

  return {
    mode: 'search',
    text: query,
    nameQ: nameWords(query),
    key: `search|${query}`
  }
}

function nameWords (text) {
  return text.replace(/"/g, '').split(/\s+/).filter(word => word && !/^([@~]|url:)/.test(word)).join(' ')
}

// puts @ or ~ at the end of the text as a word of its own. it replaces one
// that's already there with nothing after it
export function appendPrefix (text, prefix) {
  const before = text.replace(/(^|\s)[@~]?\s*$/, '')
  return before ? `${before} ${prefix}` : prefix
}

export function cutWord (text, start, end) {
  return { text: text.slice(0, start) + text.slice(end).trimStart(), caret: start }
}
