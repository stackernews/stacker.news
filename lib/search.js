const DOUBLE_QUOTE_VARIANTS = [
  '\u201C', // left double quotation mark
  '\u201D', // right double quotation mark
  '\u201E', // double low-9 quotation mark
  '\u201F', // double high-reversed-9 quotation mark
  '\u00AB', // left-pointing double angle quotation mark
  '\u00BB', // right-pointing double angle quotation mark
  '\uFF02', // fullwidth quotation mark
  '\u300C', // left corner bracket
  '\u300D', // right corner bracket
  '\u300E', // left white corner bracket
  '\u300F', // right white corner bracket
  '\u301D', // reversed double prime quotation mark
  '\u301E', // double prime quotation mark
  '\u301F' // low double prime quotation mark
]

const SMART_DOUBLE_QUOTES_REGEX = new RegExp(`[${DOUBLE_QUOTE_VARIANTS.join('')}]`, 'g')

function phraseRegex () {
  return /"([^"]*)"/gm
}

function normalizeSearchQuery (q = '') {
  if (typeof q !== 'string') return ''
  // Normalize common Unicode double-quote variants so phrase parsing can
  // treat them all like ASCII double quotes.
  return q.replace(SMART_DOUBLE_QUOTES_REGEX, '"')
}

export function queryParts (q = '') {
  const normalized = normalizeSearchQuery(q)
  const quotes = [...normalized.matchAll(phraseRegex())]
    .map(m => m[1])
    .filter(quote => quote.trim().length > 0)
  const queryArr = normalized.replace(phraseRegex(), ' ').trim().split(/\s+/).filter(Boolean)
  const url = queryArr.find(word => word.startsWith('url:'))
  const nym = queryArr.find(word => word.startsWith('@'))
  const territory = queryArr.find(word => word.startsWith('~'))
  const exclude = [url, nym, territory]
  const query = queryArr.filter(word => !exclude.includes(word)).join(' ')

  return {
    quotes,
    nym,
    url,
    territory,
    query
  }
}

export const SEARCH_PATH = '/search'
export const USER_SEARCH_PATH = '/stackers/search'

export const SCOPES = [{ type: 'sub', prefix: '~' }, { type: 'user', prefix: '@' }]

export const isSearchPath = pathname => pathname === SEARCH_PATH || pathname === USER_SEARCH_PATH

// keeps the filters when already on a search page
export function searchHref (q, { pathname, query = {} } = {}) {
  if (pathname === USER_SEARCH_PATH) {
    return `${USER_SEARCH_PATH}?${new URLSearchParams({ q })}`
  }

  const { what, sort, when, from, to } = pathname === SEARCH_PATH ? query : {}
  const params = Object.entries({ q, what, sort, when, from, to }).filter(
    ([, value]) => value && typeof value === 'string'
  )

  return `${SEARCH_PATH}?${new URLSearchParams(params)}`
}

export function joinScope (scope = {}, text = '') {
  return [...SCOPES.map(({ type, prefix }) => scope[type] && prefix + scope[type]), text.trim()].filter(Boolean).join(' ')
}

// takes the ~territory and @nym out of q to show chips
export function splitScope (q = '') {
  const { territory, nym, url, quotes, query } = queryParts(q)
  const scope = { sub: territory?.slice(1) || undefined, user: nym?.slice(1) || undefined }

  if (!scope.sub && !scope.user) {
    return { scope, text: q.trim() }
  }

  // a ~ or @ with no name after it stays in the text
  const bare = [!scope.sub && territory, !scope.user && nym]

  const ordered = [
    ...bare,
    ...quotes.map(quote => `"${quote}"`),
    url,
    query
  ].filter(Boolean).join(' ')

  return { scope, text: ordered }
}
