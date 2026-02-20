import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { whenToFrom } from '@/lib/time'
import { getItem, itemQueryWithMeta, SELECT } from './item'
import { parse } from 'tldts'
import { searchSchema, validateSchema } from '@/lib/validate'
import { DEFAULT_POSTS_SATS_FILTER, DEFAULT_COMMENTS_SATS_FILTER } from '@/lib/constants'
import { resolveOpensearchModelId } from '../search/model-id'

function queryParts (q) {
  const regex = /"([^"]*)"/gm

  const queryArr = q.replace(regex, '').trim().split(/\s+/)
  const url = queryArr.find(word => word.startsWith('url:'))
  const nym = queryArr.find(word => word.startsWith('@'))
  const territory = queryArr.find(word => word.startsWith('~'))
  const exclude = [url, nym, territory]
  const query = queryArr.filter(word => !exclude.includes(word)).join(' ')

  return {
    quotes: [...q.matchAll(regex)].map(m => m[1]),
    nym,
    url,
    territory,
    query
  }
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
// Handles nym bypass, owner bypass, and type-aware thresholds.
function satsInvestmentFilter ({ what, nym, postsSatsFilter, commentsSatsFilter, meId }) {
  // skip when searching a specific nym — the user explicitly
  // wants that person's items regardless of investment
  if (nym) return null

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
  const pattern = `*${nym.slice(1).toLowerCase()}*`
  return {
    filters: [{ wildcard: { 'user.name': pattern } }],
    queries: [{ wildcard: { 'user.name': pattern } }]
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
    filters.push({
      multi_match: {
        query: quote,
        fields: ['title.exact', 'text.exact'],
        type: 'phrase'
      }
    })
    queries.push({
      multi_match: {
        query: quote,
        fields: ['title.exact^10', 'text.exact'],
        type: 'phrase',
        boost: 1000
      }
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
      addMembers: {
        sort: [
          { [field]: { order: 'desc' } },
          { _id: { order: 'desc' } }
        ]
      }
    }
  }

  // default: relevance with gentle recency decay
  return {
    functions: [{
      gauss: {
        createdAt: {
          origin: 'now',
          scale: '90d',
          decay: 0.5
        }
      }
    }],
    addMembers: {}
  }
}

// Returns base text queries for broad retrieval.
// Fuzzy best_fields provides recall with typo tolerance.
// Stemmed cross_fields rewards complete matches across title+text.
// Exact cross_fields rewards unstemmed complete matches.
function baseTextQueries (query) {
  return [
    {
      multi_match: {
        query,
        type: 'best_fields',
        fields: ['title^10', 'text'],
        fuzziness: 'AUTO:4,7',
        prefix_length: 2,
        minimum_should_match: '50%'
      }
    },
    {
      multi_match: {
        query,
        type: 'cross_fields',
        fields: ['title^10', 'text'],
        operator: 'and',
        boost: 2
      }
    },
    {
      multi_match: {
        query,
        type: 'cross_fields',
        fields: ['title.exact^10', 'text.exact'],
        operator: 'and',
        boost: 2
      }
    }
  ]
}

// Returns tiers 2-5 wrapped in dis_max for use in a rescore window.
// Best tier wins (no additive stacking); tie_breaker gives minor credit
// for secondary matches.
function rescoreQuery (query) {
  return {
    dis_max: {
      tie_breaker: 0.1,
      queries: [
        // all terms match
        { multi_match: { query, type: 'cross_fields', fields: ['title^10', 'text'], operator: 'and', boost: 10 } },
        // phrase match
        { multi_match: { query, type: 'phrase', fields: ['title^10', 'text'], boost: 50 } },
        // exact field match
        { multi_match: { query, type: 'cross_fields', fields: ['title.exact^10', 'text.exact'], operator: 'and', boost: 40 } },
        // exact phrase match — highest
        { multi_match: { query, fields: ['title.exact^10', 'text.exact'], type: 'phrase', boost: 400 } }
      ]
    }
  }
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

// ---- Neural / hybrid wrappers ----

function neuralBoolQuery ({
  titleQuery, textQuery, filters, k, modelId, functions,
  efSearch = 200, oversampleFactor = 2.0
}) {
  const neuralFilter = filters?.length
    ? { bool: { filter: filters } }
    : undefined

  const neuralClause = (queryText, field) => ({
    neural: {
      [field]: {
        query_text: queryText,
        model_id: modelId,
        k,
        method_parameters: { ef_search: efSearch },
        rescore: { oversample_factor: oversampleFactor },
        ...(neuralFilter && { filter: neuralFilter })
      }
    }
  })

  const boolQuery = {
    bool: {
      should: [
        neuralClause(titleQuery, 'title_embedding'),
        neuralClause(textQuery, 'text_embedding')
      ],
      minimum_should_match: 1
    }
  }

  if (functions?.length) {
    return {
      function_score: {
        query: boolQuery,
        functions,
        boost_mode: 'sum'
      }
    }
  }

  return boolQuery
}

// pagination_depth must stay constant across pages for consistent hybrid
// ordering (changing it alters the candidate set before normalization).
// LIMIT * 10 covers ~10 pages of results; k >= paginationDepth.
const HYBRID_PAGINATION_DEPTH = LIMIT * 10
const HYBRID_K = LIMIT * 10

function hybridPagination () {
  return { paginationDepth: HYBRID_PAGINATION_DEPTH, k: HYBRID_K }
}

function hybridQuery (neuralQuery, keywordQuery, paginationDepth) {
  return {
    hybrid: {
      pagination_depth: paginationDepth,
      queries: [neuralQuery, keywordQuery]
    }
  }
}

// ---- Query assembly ----
// Each builds a complete OS query from flat args. No mutation.

function moreLikeThisScoreQuery (like, minMatch, filters) {
  return {
    function_score: {
      query: {
        bool: {
          should: [
            {
              more_like_this: {
                fields: ['title^2', 'text'],
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
                fields: ['title^2', 'text'],
                like,
                min_term_freq: 1,
                min_doc_freq: 1,
                min_word_length: 2,
                max_doc_freq: 1000,
                max_query_terms: 50,
                minimum_should_match: minMatch || '30%',
                boost_terms: 100
              }
            }
          ],
          filter: filters
        }
      },
      functions: [ranktopFunction()],
      boost_mode: 'multiply'
    }
  }
}

function buildRelatedQuery ({ like, minMatch, filters, titleQuery, textQuery, offset, modelId }) {
  const keywordQuery = moreLikeThisScoreQuery(like, minMatch, filters)

  if (modelId) {
    const { paginationDepth, k } = hybridPagination()
    return hybridQuery(
      neuralBoolQuery({ titleQuery, textQuery: textQuery.slice(0, 512), filters, k, modelId, functions: [ranktopFunction()] }),
      keywordQuery,
      paginationDepth
    )
  }

  return keywordQuery
}

function buildSearchQuery ({ filters, termQueries, query, neuralText, functions, offset, modelId }) {
  const should = query.length
    ? [...termQueries, ...baseTextQueries(query)]
    : termQueries

  // when functions is empty we're sorting by a field (new/sats/comments),
  // not by relevance — scores are ignored so skip function_score wrapping
  const keywordQuery = functions.length
    ? {
        function_score: {
          query: {
            bool: {
              filter: filters,
              should,
              minimum_should_match: should.length > 0 ? 1 : 0
            }
          },
          functions,
          score_mode: 'multiply',
          boost_mode: 'sum'
        }
      }
    : {
        bool: {
          filter: filters,
          should,
          minimum_should_match: should.length > 0 ? 1 : 0
        }
      }

  // rescore adjusts scores — skip when sorting by a field (scores ignored)
  const rescore = query.length && functions.length
    ? {
        window_size: Math.max(LIMIT * 10, 200),
        query: {
          rescore_query: rescoreQuery(query),
          query_weight: 1,
          rescore_query_weight: 1.6
        }
      }
    : null

  // hybrid/neural only helps when scoring matters (relevance sort);
  // for field-based sorts the keyword query provides matching and
  // the sort field determines order
  if (neuralText.length && modelId && functions.length) {
    const { paginationDepth, k } = hybridPagination()
    return {
      query: hybridQuery(
        neuralBoolQuery({ titleQuery: neuralText, textQuery: neuralText, filters, k, modelId, functions }),
        keywordQuery,
        paginationDepth
      ),
      rescore
    }
  }

  return { query: keywordQuery, rescore }
}

// ---- Result processing ----

const OS_SOURCE_EXCLUDES = ['text', 'text_embedding', 'title_embedding']

const SEARCH_HIGHLIGHT = {
  fields: {
    title: { number_of_fragments: 0, pre_tags: ['***'], post_tags: ['***'] },
    'title.exact': { number_of_fragments: 0, pre_tags: ['***'], post_tags: ['***'] },
    text: { number_of_fragments: 3, order: 'score', pre_tags: ['***'], post_tags: ['***'] },
    'text.exact': { number_of_fragments: 3, order: 'score', pre_tags: ['***'], post_tags: ['***'] }
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
    // prefer the exact highlight for text
    const textHighlight = hit?.highlight?.['text.exact'] || hit?.highlight?.text || []
    item.searchText = textHighlight
      .map(f => f.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ... ')
    return item
  })
}

// ---- Resolvers ----

export default {
  Query: {
    related: async (parent, { title, id, cursor, limit, minMatch }, { me, models, search, userLoader }) => {
      const decodedCursor = decodeCursor(cursor)

      if (!id && (!title || title.trim().split(/\s+/).length < 1)) {
        return { items: [], cursor: null }
      }

      const { postsSatsFilter } = await loadSatsFilters(me, userLoader)
      const like = id ? [{ _index: process.env.OPENSEARCH_INDEX, _id: id }] : [title]

      const mustNot = [{ exists: { field: 'parentId' } }]
      if (id) mustNot.push({ term: { id } })

      const filters = [statusFilter(mustNot)]
      if (postsSatsFilter != null) {
        filters.push({ range: { ranktop: { gte: minMatch ? 0 : postsSatsFilter * 1000 } } })
      }

      // resolve query text for neural search (only fetches item when needed)
      const modelId = await resolveOpensearchModelId(search)
      let titleQuery = title
      let textQuery = title
      if (id && modelId) {
        const item = await getItem(parent, { id }, { me, models })
        titleQuery = item.title || item.text
        textQuery = item.text || item.title
      }

      const osQuery = buildRelatedQuery({ like, minMatch, filters, titleQuery, textQuery, offset: decodedCursor.offset, modelId })
      const results = await search.search({
        index: process.env.OPENSEARCH_INDEX,
        size: limit,
        from: decodedCursor.offset,
        _source: { excludes: OS_SOURCE_EXCLUDES },
        body: { query: osQuery }
      })

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
      const neuralText = [query, ...quotes].filter(Boolean).join(' ').trim()
      const { postsSatsFilter, commentsSatsFilter } = await loadSatsFilters(me, userLoader)
      const nymParts = nymClauses(nym)
      const territoryParts = territoryClauses(territory)
      const quoteParts = quoteClauses(quotes)

      // filters determine the universe of potential search candidates
      const filters = [
        typeFilter(what, me?.id),
        statusFilter(),
        timeRangeFilter(when, whenFrom, whenTo, decodedCursor.time),
        satsInvestmentFilter({ what, nym, postsSatsFilter, commentsSatsFilter, meId: me?.id }),
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

      const { functions, addMembers } = sortFunctions(sort, query)
      const modelId = await resolveOpensearchModelId(search)
      const { query: osQuery, rescore } = buildSearchQuery({ filters, termQueries, query, neuralText, functions, offset: decodedCursor.offset, modelId })

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
            ...(rescore ? { rescore } : {}),
            highlight: SEARCH_HIGHLIGHT
          }
        })
      } catch (e) {
        console.log(e)
        return { cursor: null, items: [] }
      }

      const hits = sitems.body.hits.hits
      const items = attachHighlights(
        await hitsToItems(hits, { me, models, orderBy: 'ORDER BY rank ASC, msats DESC' }),
        hits
      )

      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    }
  }
}
