import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { whenToFrom } from '@/lib/time'
import { getItem, itemQueryWithMeta, SELECT } from './item'
import { parse } from 'tldts'
import { searchSchema, validateSchema } from '@/lib/validate'
import { DEFAULT_POSTS_SATS_FILTER, DEFAULT_COMMENTS_SATS_FILTER } from '@/lib/constants'
import { resolveOpensearchModelId } from '../search/model-id'
import removeMd from 'remove-markdown'

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

function queryParts (q = '') {
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

function rebuildSearchSuggestion ({ suggestion, quotes = [], nym, territory, url }) {
  if (!suggestion) return null

  const parts = []
  if (nym) parts.push(nym)
  if (territory) parts.push(territory)
  if (url) parts.push(url)
  for (const phrase of quotes) parts.push(`"${phrase}"`)
  parts.push(suggestion)

  return parts.join(' ')
}

// ---- Filter builders ----
// Each returns a single OpenSearch filter clause, or null to skip.

function typeFilter (what, meId) {
  switch (what) {
    case 'posts':
      return { bool: { must_not: { exists: { field: 'parentId' } } } }
    case 'comments':
      return { bool: { must: { exists: { field: 'parentId' } } } }
    case 'bookmarks':
      return meId ? { match: { bookmarkedBy: meId } } : null
    default:
      return null
  }
}

function statusFilter (mustNot) {
  return {
    bool: {
      should: [{ match: { status: 'ACTIVE' } }],
      ...(mustNot?.length ? { must_not: mustNot } : {})
    }
  }
}

function timeRangeFilter (when, whenFrom, whenTo, cursorTime) {
  const range = when === 'custom'
    ? {
        gte: whenFrom,
        lte: new Date(Math.min(new Date(Number(whenTo)), cursorTime))
      }
    : {
        lte: cursorTime,
        gte: whenToFrom(when)
      }
  return { range: { createdAt: range } }
}

// Returns a sat-investment filter clause, or null to skip.
// Handles owner bypass and type-aware thresholds.
function satsInvestmentFilter ({ what, postsSatsFilter, commentsSatsFilter, meId }) {
  // owner bypass: always show the logged-in user's own items
  const ownerBypass = meId ? [{ match: { userId: meId } }] : []

  if (what === 'comments') {
    // comments only: use the comment threshold
    if (commentsSatsFilter == null) return null
    return {
      bool: {
        should: [
          { range: { ranktop: { gte: commentsSatsFilter * 1000 } } },
          ...ownerBypass
        ]
      }
    }
  }

  if (what === 'posts') {
    // posts only: use the post threshold
    if (postsSatsFilter == null) return null
    return {
      bool: {
        should: [
          { range: { ranktop: { gte: postsSatsFilter * 1000 } } },
          ...ownerBypass
        ]
      }
    }
  }

  // default (all items): apply the appropriate threshold per item type
  if (postsSatsFilter == null && commentsSatsFilter == null) return null

  return {
    bool: {
      should: [
        // posts: no parentId, apply post threshold (null = show all posts)
        {
          bool: {
            must_not: { exists: { field: 'parentId' } },
            ...(postsSatsFilter != null
              ? { filter: { range: { ranktop: { gte: postsSatsFilter * 1000 } } } }
              : {})
          }
        },
        // comments: has parentId, apply comment threshold (null = show all comments)
        {
          bool: {
            must: { exists: { field: 'parentId' } },
            ...(commentsSatsFilter != null
              ? { filter: { range: { ranktop: { gte: commentsSatsFilter * 1000 } } } }
              : {})
          }
        },
        // owner bypass: always show the user's own items
        ...ownerBypass
      ]
    }
  }
}

async function loadSatsFilters (me, userLoader) {
  let postsSatsFilter = DEFAULT_POSTS_SATS_FILTER
  let commentsSatsFilter = DEFAULT_COMMENTS_SATS_FILTER
  if (me) {
    const user = await userLoader.load(me.id)
    postsSatsFilter = user.postsSatsFilter
    commentsSatsFilter = user.commentsSatsFilter
  }
  return { postsSatsFilter, commentsSatsFilter }
}

// ---- Query-part builders ----
// Each returns { filters: [...], queries: [...] } for spreading into
// the filter and termQuery arrays.

function nymClauses (nym) {
  if (!nym) return { filters: [], queries: [] }
  const name = nym.slice(1).toLowerCase()
  if (!name) return { filters: [], queries: [] } // guard: bare "@" with no name
  const pattern = `*${name}*`
  // Strict author-only filter for @nym searches.
  // case_insensitive: keyword field stores original case; queries are lowercased
  return {
    filters: [{ wildcard: { 'user.name': { value: pattern, case_insensitive: true } } }],
    queries: []
  }
}

function territoryClauses (territory) {
  if (!territory) return { filters: [], queries: [] }
  const name = territory.slice(1)
  const currentField = { match: { subNames: name } }
  const legacyField = { match: { 'sub.name': name } }
  return {
    filters: [{
      bool: {
        should: [currentField, legacyField],
        minimum_should_match: 1
      }
    }],
    queries: [
      { match: { subNames: { query: name, boost: 100 } } },
      { match: { 'sub.name': { query: name, boost: 100 } } }
    ]
  }
}

function quoteClauses (quotes) {
  if (!quotes?.length) return { filters: [], queries: [] }
  const filters = []
  const queries = []
  for (const quote of quotes) {
    // Filter on stemmed field: "bitcoin mining" also matches "bitcoin mined" etc.
    filters.push({
      match_phrase: { title_text: quote }
    })
    // Score: exact unstemmed phrase gets highest boost
    queries.push({
      match_phrase: { 'title_text.exact': { query: quote, boost: 1000 } }
    })
    queries.push({
      match_phrase: { title_text: { query: quote, boost: 500 } }
    })
  }
  return { filters, queries }
}

// Returns an array of term queries for url matching (no filter needed).
function urlQueries (url) {
  if (!url) return []
  let uri = url.slice(4)
  const queries = [
    { match_bool_prefix: { url: { query: uri, operator: 'and', boost: 1000 } } }
  ]
  const parsed = parse(uri)
  if (parsed?.subdomain?.length > 0) {
    uri = uri.replace(`${parsed.subdomain}.`, '')
  }
  queries.push({ wildcard: { url: { value: `*${uri}*` } } })
  return queries
}

// ---- Scoring & text match ----

const SORT_FIELDS = {
  comments: 'ncomments',
  sats: 'ranktop',
  new: 'createdAt'
}

function sortFunctions (sort, query) {
  const field = SORT_FIELDS[sort]
  if (field) {
    return {
      functions: [],
      isRelevanceSort: false,
      addMembers: {
        sort: [
          { [field]: { order: 'desc' } },
          { _id: { order: 'desc' } }
        ]
      }
    }
  }

  // default: relevance with gentle recency + investment decay
  // Only affects the lexical leg; neural legs stay pure relevance via RRF
  return {
    functions: [],
    isRelevanceSort: true,
    addMembers: {}
  }
}

// Returns base text queries for broad retrieval on the title_text concat field.
// Title+text are concatenated at ingest (title first), matching how semantic
// and sparse legs already work. Single-field BM25 avoids cross_fields quirks.
function baseTextQueries (query) {
  // Broad recall (50% of terms, fuzzy) + precision lanes (all terms, high boost).
  // The high AND-match boost ensures docs matching ALL query terms always make
  // it into the hybrid candidate set, even when common terms like "lightning network"
  // produce thousands of partial matches that would otherwise flood the pool.
  return [
    {
      match: {
        title_text: {
          query,
          fuzziness: 'AUTO:4,7',
          prefix_length: 2,
          minimum_should_match: '50%'
        }
      }
    },
    {
      match: {
        title_text: {
          query,
          operator: 'and',
          boost: 10
        }
      }
    },
    {
      match: {
        'title_text.exact': {
          query,
          operator: 'and',
          boost: 10
        }
      }
    },
    {
      match: {
        title: {
          query,
          minimum_should_match: '50%',
          boost: 3
        }
      }
    }
  ]
}

const EXACT_INTENT_MIN_QUERY_LENGTH = 5
const EXACT_INTENT_MAX_TOKENS = 2

function freeTextTokenCount (query = '') {
  const trimmed = query.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function shouldUseExactIntentLeg ({ query, quotes, isRelevanceSort }) {
  if (!isRelevanceSort) return false
  if (quotes?.length) return false

  const trimmed = query.trim()
  if (!trimmed || trimmed.length < EXACT_INTENT_MIN_QUERY_LENGTH) return false

  return freeTextTokenCount(trimmed) <= EXACT_INTENT_MAX_TOKENS
}

function exactTextLeg (query) {
  const trimmed = query.trim()
  return {
    bool: {
      should: [
        // Strict exact phrase match in normalized title+text field.
        { match_phrase: { 'title_text.exact': { query: trimmed, boost: 1000 } } },
        // Title-only exact phrase lane.
        { match_phrase: { 'title.exact': { query: trimmed, boost: 800 } } },
        // Exact analyzer all-terms lane for short multi-token intent.
        { match: { 'title_text.exact': { query: trimmed, operator: 'and', boost: 200 } } }
      ],
      minimum_should_match: 1
    }
  }
}

function normalizeSearchText (text = '') {
  return typeof text === 'string' ? removeMd(text).trim() : ''
}

function joinTitleAndText (title = '', text = '') {
  const normalizedTitle = title.trim()
  const normalizedText = text.trim()
  if (normalizedTitle && normalizedText) return `${normalizedTitle}\n\n${normalizedText}`
  return normalizedTitle || normalizedText
}

function buildRelatedSource ({ title, text }) {
  const normalizedTitle = title?.trim() || ''
  const normalizedText = normalizeSearchText(text)

  return {
    title: normalizedTitle,
    hasBody: normalizedText.length > 0,
    textQuery: joinTitleAndText(normalizedTitle, normalizedText)
  }
}

function buildRelatedExtraShould (source) {
  const should = []

  if (!source.hasBody && source.title.length >= EXACT_INTENT_MIN_QUERY_LENGTH) {
    should.push(exactTextLeg(source.title))
  }

  return should
}

// ---- Scoring helpers ----

function ranktopFunction () {
  return {
    // Downvoted items can have negative ranktop; guard ln2p from invalid inputs.
    // Keep missing-field behavior by still allowing docs without ranktop.
    filter: {
      bool: {
        should: [
          { range: { ranktop: { gte: 0 } } },
          { bool: { must_not: { exists: { field: 'ranktop' } } } }
        ],
        minimum_should_match: 1
      }
    },
    field_value_factor: {
      field: 'ranktop',
      modifier: 'ln2p',
      factor: 0.0001,
      missing: 0
    }
  }
}

function ranktopRescoreFunction () {
  return {
    // Rescore uses multiplicative blending, so keep this signal small and
    // bounded-ish (via ln1p with tiny factor) to nudge, not overwrite, _score.
    filter: {
      bool: {
        should: [
          { range: { ranktop: { gte: 0 } } },
          { bool: { must_not: { exists: { field: 'ranktop' } } } }
        ],
        minimum_should_match: 1
      }
    },
    field_value_factor: {
      field: 'ranktop',
      modifier: 'ln1p',
      factor: 1e-10,
      missing: 0
    }
  }
}

// ---- Neural / hybrid wrappers ----

// Term-level spell correction: corrects each misspelled word independently.
// Uses suggest_mode=missing (only fires for words not in the index),
// sort=score (edit distance first, not raw frequency), on text.exact
// (larger vocabulary than titles). Much more precise than phrase suggest
// for per-word typos: corrects 7/11 test typos with 0 false positives
// vs phrase suggest's 2/11.
const TERM_SUGGEST_PARAMS = {
  field: 'text.exact',
  suggest_mode: 'missing',
  sort: 'score',
  min_word_length: 4,
  prefix_length: 2,
  string_distance: 'damerau_levenshtein',
  max_edits: 2
}
const MIN_TERM_FREQ = 3 // suggestion must appear in at least 3 docs

function applyTermCorrections (termEntries) {
  if (!termEntries?.length) return null
  const words = []
  let changed = false
  for (const entry of termEntries) {
    const opts = entry.options || []
    if (opts.length > 0 && opts[0].freq >= MIN_TERM_FREQ) {
      words.push(opts[0].text)
      changed = true
    } else {
      words.push(entry.text)
    }
  }
  return changed ? words.join(' ') : null
}

// Pre-query spell check: run a cheap suggest-only query to get the corrected
// spelling BEFORE building the hybrid query. This lets neural legs (semantic +
// sparse) receive the corrected text instead of the raw typo.
// BM25 already has fuzziness (AUTO:4,7), but neural models can't do fuzzy
// matching — "bitconi" embeds/tokenizes completely differently from "bitcoin".
async function spellCheckQuery (search, query) {
  if (!query?.trim()) return null
  try {
    const result = await search.search({
      index: process.env.OPENSEARCH_INDEX,
      size: 0,
      body: {
        suggest: {
          text: query,
          term_suggest: { term: TERM_SUGGEST_PARAMS }
        }
      }
    })
    const corrected = applyTermCorrections(result.body.suggest?.term_suggest)
    if (corrected && corrected.toLowerCase() !== query.toLowerCase()) {
      return corrected
    }
  } catch (e) {
    console.error('[SEARCH SPELL-CHECK ERROR]', e?.message || e)
  }
  return null
}

function buildSemanticTextLeg ({ queryText, modelId, k }) {
  // text_semantic is a semantic field (OS 3.1+) — uses `neural` query type
  // Filters are applied at the hybrid.filter level, not per-leg
  return {
    neural: {
      text_semantic: {
        query_text: queryText,
        model_id: modelId,
        k
      }
    }
  }
}

function buildSparseLeg ({ queryText }) {
  // neural_sparse on text_sparse (rank_features field)
  // doc-only mode: uses bert-uncased analyzer at search time (no model inference)
  // learned term expansion captures domain semantics beyond exact keyword match
  // Filters are applied at the hybrid.filter level, not per-leg
  return {
    neural_sparse: {
      text_sparse: {
        query_text: queryText,
        analyzer: 'bert-uncased'
      }
    }
  }
}

// pagination_depth must stay constant across pages for consistent hybrid
// ordering (changing it alters the candidate set before normalization).
const HYBRID_DEPTH = LIMIT * 10

const RESCORE_WINDOW_SIZE = HYBRID_DEPTH
const RESCORE_QUERY_WEIGHT = 1
const SEARCH_RESCORE_QUERY_WEIGHT = 1
const RELATED_RESCORE_QUERY_WEIGHT = 1
const RELATED_RECENCY_WEIGHT = 0.08

function buildRanktopRescore ({ includeRecency = false } = {}) {
  return {
    window_size: RESCORE_WINDOW_SIZE,
    query: {
      query_weight: RESCORE_QUERY_WEIGHT,
      rescore_query_weight: includeRecency ? RELATED_RESCORE_QUERY_WEIGHT : SEARCH_RESCORE_QUERY_WEIGHT,
      // Multiplicative blending makes the rerank relative to base _score.
      score_mode: 'multiply',
      rescore_query: {
        function_score: {
          query: { match_all: {} },
          functions: [
            ranktopRescoreFunction(),
            ...(includeRecency
              ? [{
                  weight: RELATED_RECENCY_WEIGHT,
                  gauss: {
                    createdAt: {
                      origin: 'now',
                      scale: '45d',
                      decay: 0.6
                    }
                  }
                }]
              : [])
          ],
          score_mode: 'sum',
          boost_mode: 'sum'
        }
      }
    }
  }
}

function hybridQuery (queries, filters) {
  return {
    hybrid: {
      pagination_depth: HYBRID_DEPTH,
      queries,
      ...(filters?.length ? { filter: { bool: { filter: filters } } } : {})
    }
  }
}

// ---- Query assembly ----
// Each builds a complete OS query from flat args. No mutation.

function moreLikeThisScoreQuery ({ like, minMatch, filters, extraShould = [] }) {
  const should = [
    {
      more_like_this: {
        fields: ['title_text'],
        like,
        min_term_freq: 1,
        min_doc_freq: 1,
        min_word_length: 2,
        max_doc_freq: 10000,
        max_query_terms: 50,
        minimum_should_match: minMatch || '30%',
        boost_terms: 10
      }
    },
    {
      more_like_this: {
        fields: ['title_text'],
        like,
        min_term_freq: 1,
        min_doc_freq: 1,
        min_word_length: 2,
        max_doc_freq: 1000,
        max_query_terms: 50,
        minimum_should_match: minMatch || '30%',
        boost_terms: 100
      }
    },
    ...extraShould
  ]

  return {
    function_score: {
      query: {
        bool: {
          should,
          minimum_should_match: 1,
          ...(filters?.length ? { filter: filters } : {})
        }
      },
      functions: [ranktopFunction()],
      boost_mode: 'multiply'
    }
  }
}

const MAX_NEURAL_TEXT_LENGTH = 512

function buildRelatedQuery ({ like, minMatch, filters, source, modelId }) {
  const extraShould = buildRelatedExtraShould(source)

  if (source.textQuery?.trim() && modelId) {
    const neuralText = source.textQuery.slice(0, MAX_NEURAL_TEXT_LENGTH)
    const legs = [
      moreLikeThisScoreQuery({ like, minMatch, filters: [], extraShould }),
      buildSemanticTextLeg({ queryText: neuralText, modelId, k: HYBRID_DEPTH }),
      buildSparseLeg({ queryText: neuralText })
    ]
    return hybridQuery(legs, filters)
  }

  return moreLikeThisScoreQuery({ like, minMatch, filters, extraShould })
}

function buildSearchQuery ({
  filters,
  termQueries,
  query,
  neuralText,
  functions,
  modelId,
  isRelevanceSort,
  exactIntentLeg = false
}) {
  const should = query.length
    ? [...termQueries, ...baseTextQueries(query)]
    : termQueries

  const minMatch = should.length > 0 ? 1 : 0

  const bm25WithFilters = {
    bool: { filter: filters, should, minimum_should_match: minMatch }
  }

  // hybrid/neural only helps when scoring matters (relevance sort);
  // for field-based sorts the keyword query provides matching and
  // the sort field determines order.
  if (neuralText?.trim() && modelId && isRelevanceSort) {
    const bm25HybridLeg = {
      bool: { should, minimum_should_match: minMatch }
    }
    const legs = [
      bm25HybridLeg,
      ...(exactIntentLeg ? [exactTextLeg(query)] : []),
      buildSemanticTextLeg({ queryText: neuralText, modelId, k: HYBRID_DEPTH }),
      buildSparseLeg({ queryText: neuralText })
    ]
    return hybridQuery(legs, filters)
  }

  // Lexical-only fallback: wrap with function_score for relevance sort
  // so business signals (recency, ranktop) contribute to ranking.
  if (isRelevanceSort && functions.length > 0) {
    return {
      function_score: {
        query: bm25WithFilters,
        functions,
        score_mode: 'multiply',
        boost_mode: 'sum'
      }
    }
  }

  return bm25WithFilters
}

// ---- Result processing ----

const OS_SOURCE_EXCLUDES = ['text', 'title_text', 'title_embedding', 'text_embedding', 'text_semantic', 'text_semantic_semantic_info', 'text_sparse']

const SEARCH_HIGHLIGHT = {
  fields: {
    title: { number_of_fragments: 0, pre_tags: ['***'], post_tags: ['***'] },
    'title.exact': { number_of_fragments: 0, pre_tags: ['***'], post_tags: ['***'] },
    text: { number_of_fragments: 3, order: 'score', pre_tags: ['***'], post_tags: ['***'] },
    'text.exact': { number_of_fragments: 3, order: 'score', pre_tags: ['***'], post_tags: ['***'] },
    title_text: { number_of_fragments: 3, order: 'score', pre_tags: ['***'], post_tags: ['***'] },
    'title_text.exact': { number_of_fragments: 3, order: 'score', pre_tags: ['***'], post_tags: ['***'] }
  }
}

async function hitsToItems (hits, { me, models, orderBy }) {
  const values = hits.map((e, i) => `(${e._source.id}, ${i})`).join(',')

  if (values.length === 0) return []

  return itemQueryWithMeta({
    me,
    models,
    query: `
      WITH r(id, rank) AS (VALUES ${values})
      ${SELECT}, rank
      FROM "Item"
      JOIN r ON "Item".id = r.id`,
    orderBy
  })
}

function attachHighlights (items, hits) {
  // Build a lookup by item id so we pair each DB item with its correct
  // OpenSearch hit. hitsToItems can return fewer rows than hits when items
  // have been deleted from the DB (the SQL JOIN drops missing rows), so
  // matching by array index would attach the wrong highlights.
  const hitById = new Map(hits.map(h => [Number(h._source.id), h]))

  return items.map(item => {
    const hit = hitById.get(item.id)
    // prefer the fuzzier highlight for title
    item.searchTitle = hit?.highlight?.title?.[0] || hit?.highlight?.['title.exact']?.[0] || item.title
    // prefer exact text highlights; fall back to title_text and strip duplicated
    // title prefix for posts ("title\\n\\ntext").
    const textHighlights = hit?.highlight?.['text.exact'] || hit?.highlight?.text
    const titleTextHighlights = hit?.highlight?.['title_text.exact'] || hit?.highlight?.title_text
    const usingTitleTextFallback = !textHighlights && !!titleTextHighlights
    const plainTitle = (item.searchTitle || item.title || '').replace(/\*\*\*/g, '').replace(/\s+/g, ' ').trim()

    item.searchText = (textHighlights || titleTextHighlights || [])
      .map(fragment => {
        if (usingTitleTextFallback && !item.parentId) {
          const parts = fragment.split(/\n{2,}/)
          if (parts.length > 1) {
            fragment = parts.slice(1).join(' ')
          }
        }
        return fragment.replace(/\s+/g, ' ').trim()
      })
      .filter(Boolean)
      .filter(fragment => !(
        usingTitleTextFallback &&
        !item.parentId &&
        fragment.replace(/\*\*\*/g, '').replace(/\s+/g, ' ').trim() === plainTitle
      ))
      .join(' ... ')
    return item
  })
}

// ---- Resolvers ----

export default {
  Query: {
    related: async (parent, { title, id, cursor, limit, minMatch }, { me, models, search }) => {
      const decodedCursor = decodeCursor(cursor)

      if (!id && (!title || title.trim().split(/\s+/).length < 1)) {
        return { items: [], cursor: null }
      }

      const postsSatsFilter = DEFAULT_POSTS_SATS_FILTER
      const like = id ? [{ _index: process.env.OPENSEARCH_INDEX, _id: id }] : [title]

      const mustNot = [{ exists: { field: 'parentId' } }]
      if (id) mustNot.push({ term: { id } })

      const filters = [statusFilter(mustNot)]
      if (postsSatsFilter != null) {
        filters.push({ range: { ranktop: { gte: minMatch ? 0 : postsSatsFilter * 1000 } } })
      }

      const modelId = await resolveOpensearchModelId(search)
      let source = buildRelatedSource({ title })
      if (id) {
        const item = await getItem(parent, { id }, { me, models })
        if (item) {
          source = buildRelatedSource(item)
        }
      }

      const osQuery = buildRelatedQuery({ like, minMatch, filters, source, modelId })
      let results
      try {
        results = await search.search({
          index: process.env.OPENSEARCH_INDEX,
          size: limit,
          from: decodedCursor.offset,
          _source: { excludes: OS_SOURCE_EXCLUDES },
          body: {
            query: osQuery,
            rescore: buildRanktopRescore({ includeRecency: true })
          }
        })
      } catch (e) {
        console.error('[RELATED SEARCH ERROR]', e?.meta?.body ? JSON.stringify(e.meta.body, null, 2) : (e?.message || e))
        return { cursor: null, items: [] }
      }

      const items = await hitsToItems(results.body.hits.hits, { me, models, orderBy: 'ORDER BY rank ASC' })
      return {
        cursor: items.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
        items
      }
    },

    search: async (parent, { q, cursor, sort, what, when, from: whenFrom, to: whenTo }, { me, models, search, userLoader }) => {
      await validateSchema(searchSchema, { q })
      const decodedCursor = decodeCursor(cursor)

      if (!q || (what === 'bookmarks' && !me)) {
        return { items: [], cursor: null }
      }

      // parse query and load user preferences
      const { query, quotes, nym, url, territory } = queryParts(q)

      // Pre-query spell check: correct typos for neural legs.
      // BM25 has fuzziness, but semantic/sparse models can't fuzzy-match —
      // "bitconi" embeds as garbage while "bitcoin" embeds correctly.
      const spellCorrected = await spellCheckQuery(search, query)
      const neuralText = [(spellCorrected || query), ...quotes].filter(Boolean).join(' ').trim().slice(0, MAX_NEURAL_TEXT_LENGTH)

      const { postsSatsFilter, commentsSatsFilter } = await loadSatsFilters(me, userLoader)
      const nymParts = nymClauses(nym)
      const territoryParts = territoryClauses(territory)
      const quoteParts = quoteClauses(quotes)

      // filters determine the universe of potential search candidates
      const filters = [
        typeFilter(what, me?.id),
        statusFilter(),
        timeRangeFilter(when, whenFrom, whenTo, decodedCursor.time),
        satsInvestmentFilter({ what, postsSatsFilter, commentsSatsFilter, meId: me?.id }),
        ...nymParts.filters,
        ...territoryParts.filters,
        ...quoteParts.filters
      ].filter(Boolean)

      // term queries contribute to relevance scoring
      const termQueries = [
        ...urlQueries(url),
        ...nymParts.queries,
        ...territoryParts.queries,
        ...quoteParts.queries
      ]

      const { functions, addMembers, isRelevanceSort } = sortFunctions(sort, query)
      const exactIntentLeg = shouldUseExactIntentLeg({ query, quotes, isRelevanceSort })
      const modelId = await resolveOpensearchModelId(search)

      const osQuery = buildSearchQuery({
        filters,
        termQueries,
        query,
        neuralText,
        functions,
        modelId,
        isRelevanceSort,
        exactIntentLeg
      })

      let sitems
      try {
        sitems = await search.search({
          index: process.env.OPENSEARCH_INDEX,
          size: LIMIT,
          _source: { excludes: OS_SOURCE_EXCLUDES },
          from: decodedCursor.offset,
          body: {
            query: osQuery,
            ...addMembers,
            ...(isRelevanceSort ? { rescore: buildRanktopRescore() } : {}),
            highlight: SEARCH_HIGHLIGHT,
            // Combined suggest for "did you mean?": term suggest (per-word, precise)
            // + phrase suggest (full-phrase fallback for words that exist but are wrong,
            // e.g. "lightening" → "lightning"). Term suggest is preferred; phrase is
            // fallback when term has no correction.
            ...(query.length
              ? {
                  suggest: {
                    text: query,
                    term_suggest: { term: TERM_SUGGEST_PARAMS },
                    phrase_suggest: {
                      phrase: {
                        field: 'title.exact',
                        size: 1,
                        gram_size: 3,
                        confidence: 1.0,
                        collate: {
                          query: { source: { match: { title: '{{suggestion}}' } } },
                          prune: true
                        }
                      }
                    }
                  }
                }
              : {})
          }
        })
      } catch (e) {
        const errorDetail = e?.meta?.body ? JSON.stringify(e.meta.body, null, 2) : (e?.message || e)
        console.error('[SEARCH ERROR]', errorDetail)
        return { cursor: null, items: [] }
      }

      const hits = sitems.body.hits.hits

      let searchSuggestion = null

      // "Did you mean?" UI suggestion: combined term + phrase suggest.
      // 1. Pre-query correction (if any) — already used for neural legs
      // 2. Term suggest from main query — precise per-word corrections
      // 3. Phrase suggest fallback — catches existing-but-wrong words (e.g. "lightening")
      if (query.length && decodedCursor.offset === 0) {
        if (spellCorrected) {
          // Pre-query already found a correction — use it directly
          searchSuggestion = spellCorrected
        }

        if (!searchSuggestion) {
          // Try term suggest (per-word, precise)
          const termCorrected = applyTermCorrections(sitems.body.suggest?.term_suggest)
          if (termCorrected && termCorrected.toLowerCase() !== query.toLowerCase()) {
            searchSuggestion = termCorrected
          }
        }

        if (!searchSuggestion) {
          // Fall back to phrase suggest (catches words that exist but are likely wrong)
          const phraseSuggestion = sitems.body.suggest?.phrase_suggest?.[0]?.options?.[0]
          const MIN_PHRASE_SCORE = 0.001
          if (phraseSuggestion?.text && phraseSuggestion.collate_match &&
              phraseSuggestion.score >= MIN_PHRASE_SCORE &&
              phraseSuggestion.text.toLowerCase() !== query.toLowerCase()) {
            searchSuggestion = phraseSuggestion.text
          }
        }

        // searchSuggestion so far is only the corrected free-text portion.
        // Rebuild the full query string so "Did you mean?" preserves
        // @nym, ~territory, url:, and "quoted phrase" filters.
        if (searchSuggestion) {
          searchSuggestion = rebuildSearchSuggestion({
            suggestion: searchSuggestion,
            quotes,
            nym,
            territory,
            url
          })
        }
      }
      const items = attachHighlights(
        await hitsToItems(hits, { me, models, orderBy: 'ORDER BY rank ASC, msats DESC' }),
        hits
      )

      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items,
        searchSuggestion
      }
    }
  }
}
