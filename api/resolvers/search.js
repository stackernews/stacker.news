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
  const name = nym.slice(1).toLowerCase()
  if (!name) return { filters: [], queries: [] } // guard: bare "@" with no name
  const pattern = `*${name}*`
  // Filter: author match OR text/title mention (so docs *about* the nym are found
  // even when the user has few/no indexed items)
  // Scoring: heavily boost author matches so "by @user" ranks above "mentions @user"
  // case_insensitive: keyword field stores original case; queries are lowercased
  // NOTE: satsInvestmentFilter bypasses thresholds when nym is present, so mention-only
  // items aren't sats-filtered. This is intentional: explicit @nym search = show everything.
  //
  // Short names (<3 chars) skip text/title phrase matching — too many false positives
  // from common words. Author wildcard match still works for short names.
  const includeTextMention = name.length >= 3

  return {
    filters: [{
      bool: {
        should: [
          { wildcard: { 'user.name': { value: pattern, case_insensitive: true } } },
          ...(includeTextMention
            ? [{ match_phrase: { title_text: name } }]
            : [])
        ],
        minimum_should_match: 1
      }
    }],
    queries: [
      { wildcard: { 'user.name': { value: pattern, boost: 100, case_insensitive: true } } },
      ...(includeTextMention
        ? [{ match_phrase: { title_text: { query: name, boost: 5 } } }]
        : [])
    ]
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
    functions: [
      {
        gauss: {
          createdAt: {
            origin: 'now',
            scale: '90d',
            decay: 0.5
          }
        }
      },
      ranktopFunction()
    ],
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
// Feature flags (env vars):
//   SEARCH_DISABLE_NEURAL — disable all neural legs (lexical-only fallback)
//   SEARCH_DISABLE_SEMANTIC — disable semantic leg only
//   SEARCH_DISABLE_SPARSE — disable sparse leg only
//   SEARCH_DISABLE_SPELL_CORRECT — disable spell correction

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
  if (process.env.SEARCH_DISABLE_SPELL_CORRECT || !query?.trim()) return null
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

// Detect rare terms in a query by checking document frequency.
// Returns rare terms that appear in significantly fewer docs than common ones.
// Used to add a discriminative boost at the hybrid filter level so all 3 legs
// favor docs containing the rare term. Without this, queries like
// "africa lightning network" return mostly "lightning network" docs because
// all legs agree the common terms are more relevant.
const RARE_TERM_RATIO = 0.1 // term is "rare" if its DF < 10% of the most common term's DF
const MIN_RARE_TERM_DF = 3 // skip terms that appear in <3 docs (probably typos)

async function detectRareTerms (search, query) {
  if (!query?.trim()) return []
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2)
  if (terms.length < 2) return [] // single-term queries don't have a rare/common split

  try {
    // Get document frequency for each term via filter aggregations (single request)
    const aggs = {}
    for (const term of terms) {
      aggs[`df_${term}`] = { filter: { match: { title_text: term } } }
    }

    const result = await search.search({
      index: process.env.OPENSEARCH_INDEX,
      size: 0,
      body: { aggs }
    })

    const dfs = terms.map(term => ({
      term,
      freq: result.body.aggregations?.[`df_${term}`]?.doc_count || 0
    }))

    const maxFreq = Math.max(...dfs.map(d => d.freq))
    if (maxFreq === 0) return []

    // Rare terms: significantly lower DF than the most common term
    // Returns objects with { term, freq, repeats } for IDF-weighted repetition
    const rare = dfs
      .filter(d => d.freq >= MIN_RARE_TERM_DF && d.freq < maxFreq * RARE_TERM_RATIO)
      .map(d => ({
        term: d.term,
        freq: d.freq,
        repeats: Math.min(3, Math.ceil(Math.log2(maxFreq / d.freq)))
      }))

    if (rare.length > 0) {
      console.log(`[SEARCH RARE-TERMS] query="${query}" dfs=${JSON.stringify(dfs.map(d => `${d.term}:${d.freq}`))} rare=${JSON.stringify(rare)}`)
    }
    return rare
  } catch (e) {
    console.error('[SEARCH RARE-TERM DETECTION ERROR]', e?.message || e)
    return []
  }
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

function hybridQuery (queries, filters, depth) {
  return {
    hybrid: {
      pagination_depth: depth || HYBRID_DEPTH,
      queries,
      ...(filters?.length ? { filter: { bool: { filter: filters } } } : {})
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

const MAX_NEURAL_TEXT_LENGTH = 512

// ---- Rare-term handling (Tier 1) ----

// Strategy 1: Repeat rare terms in neural text to shift embeddings.
// "africa lightning network" → "africa africa africa lightning network"
// Uses IDF-weighted repeats: rarer terms get more repetitions.
// RARE_TERM_REPEAT_MODE controls which legs get the repeated text:
//   'none'   — both legs use plain text (default)
//   'both'   — same repeated text for semantic + sparse
//   'dense'  — only semantic leg gets repeats, sparse gets plain text
//   'sparse' — only sparse leg gets repeats, semantic gets plain text

function buildNeuralText ({ neuralQuery, quotes, rareTerms }) {
  const base = [neuralQuery, ...quotes].filter(Boolean).join(' ').trim()
  if (!rareTerms?.length) {
    const plain = base.slice(0, MAX_NEURAL_TEXT_LENGTH)
    return { plain, withRepeats: plain }
  }
  // Append repeated rare terms after the base query text
  const allRepeats = rareTerms.flatMap(r => Array(r.repeats).fill(r.term))
  const withRepeats = [base, ...allRepeats].join(' ').trim().slice(0, MAX_NEURAL_TEXT_LENGTH)
  const plain = base.slice(0, MAX_NEURAL_TEXT_LENGTH)
  return { plain, withRepeats }
}

function buildRelatedQuery ({ like, minMatch, filters, textQuery, modelId }) {
  const hasText = textQuery?.trim()
  const enableSemantic = hasText && modelId && !process.env.SEARCH_DISABLE_NEURAL && !process.env.SEARCH_DISABLE_SEMANTIC
  const enableSparse = hasText && modelId && !process.env.SEARCH_DISABLE_NEURAL && !process.env.SEARCH_DISABLE_SPARSE

  if (enableSemantic || enableSparse) {
    const neuralText = textQuery.slice(0, MAX_NEURAL_TEXT_LENGTH)
    const legs = [moreLikeThisScoreQuery(like, minMatch, [])]
    if (enableSemantic) {
      legs.push(buildSemanticTextLeg({ queryText: neuralText, modelId, k: HYBRID_DEPTH }))
    }
    if (enableSparse) {
      legs.push(buildSparseLeg({ queryText: neuralText }))
    }
    return hybridQuery(legs, filters)
  }

  return moreLikeThisScoreQuery(like, minMatch, filters)
}

// Neural legs help when there's free text to embed. Structured-only queries
// (@nym, ~territory, url:, "quotes") don't benefit — lexical handles those.
function shouldUseNeuralLegs ({ neuralText }) {
  if (process.env.SEARCH_DISABLE_NEURAL) return false
  return !!neuralText?.trim()
}

function buildSearchQuery ({ filters, termQueries, query, neuralTextPlain, neuralTextRepeated, functions, modelId }) {
  // Strategy 2: Expand hybrid depth for rare-term queries.
  // More candidates = better chance rare-term docs survive RRF fusion.
  // Dynamic depth for rare-term queries tested: -0.0006 NDCG. Disabled.
  const depth = HYBRID_DEPTH
  const should = query.length
    ? [...termQueries, ...baseTextQueries(query)]
    : termQueries

  const isRelevanceSort = functions.length > 0

  // BM25 query with filters — used for lexical-only fallback
  const bm25WithFilters = {
    bool: {
      filter: filters,
      should,
      minimum_should_match: should.length > 0 ? 1 : 0
    }
  }

  // Pure BM25 for hybrid lexical leg — filters applied at hybrid.filter level
  const bm25HybridLeg = {
    bool: {
      should,
      minimum_should_match: should.length > 0 ? 1 : 0
    }
  }

  // Lexical-only fallback (no neural available): wrap BM25 with function_score
  // so business signals (recency, ranktop) contribute to relevance ranking.
  const lexicalOnlyQuery = isRelevanceSort && functions.length
    ? {
        function_score: {
          query: bm25WithFilters,
          functions,
          score_mode: 'multiply',
          boost_mode: 'sum'
        }
      }
    : bm25WithFilters

  // Leg-specific neural text: RARE_TERM_REPEAT_MODE controls which legs
  // get the IDF-weighted repeated text vs plain text.
  const repeatMode = process.env.RARE_TERM_REPEAT_MODE || 'none'
  const semanticText = (repeatMode === 'both' || repeatMode === 'dense') ? neuralTextRepeated : neuralTextPlain
  const sparseText = (repeatMode === 'both' || repeatMode === 'sparse') ? neuralTextRepeated : neuralTextPlain

  // hybrid/neural only helps when scoring matters (relevance sort);
  // for field-based sorts the keyword query provides matching and
  // the sort field determines order.
  const neuralText = neuralTextPlain
  const useNeural = neuralText.length && modelId && isRelevanceSort &&
    shouldUseNeuralLegs({ neuralText })
  if (useNeural) {
    // 3-leg hybrid — lexical (pure BM25) + semantic (chunked) + sparse
    // Individual leg feature flags: disable semantic or sparse independently.
    // When a leg is disabled, fall back to 2-leg hybrid or lexical-only.
    const enableSemantic = !process.env.SEARCH_DISABLE_SEMANTIC
    const enableSparse = !process.env.SEARCH_DISABLE_SPARSE

    const legs = [bm25HybridLeg]
    if (enableSemantic) {
      legs.push(buildSemanticTextLeg({ queryText: semanticText, modelId, k: depth }))
    }
    if (enableSparse) {
      legs.push(buildSparseLeg({ queryText: sparseText }))
    }
    if (legs.length > 1) {
      return { query: hybridQuery(legs, filters, depth) }
    }
    // Both neural legs disabled — fall through to lexical-only below
  }

  // Lexical-only fallback: use function_score for relevance, plain BM25 for field sorts
  return { query: lexicalOnlyQuery }
}

// ---- Result processing ----

const OS_SOURCE_EXCLUDES = ['text', 'title_text', 'text_semantic', 'text_semantic_semantic_info', 'text_sparse']

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
      let textQuery = title
      if (id && modelId) {
        const item = await getItem(parent, { id }, { me, models })
        if (item) {
          textQuery = item.text || item.title
        }
      }

      const osQuery = buildRelatedQuery({ like, minMatch, filters, textQuery, modelId })
      let results
      try {
        results = await search.search({
          index: process.env.OPENSEARCH_INDEX,
          size: limit,
          from: decodedCursor.offset,
          _source: { excludes: OS_SOURCE_EXCLUDES },
          body: { query: osQuery }
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
      const neuralQuery = spellCorrected || query

      // Detect on every page so pagination keeps identical ranking semantics.
      const rareTerms = query.length
        ? await detectRareTerms(search, query)
        : []

      // Strategy 1: Repeat rare terms in neural text to bias embeddings
      const { plain: neuralTextPlain, withRepeats: neuralTextRepeated } = buildNeuralText({ neuralQuery, quotes, rareTerms })

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

      const { query: osQuery } = buildSearchQuery({ filters, termQueries, query, neuralTextPlain, neuralTextRepeated, functions, modelId })

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
            highlight: SEARCH_HIGHLIGHT,
            // Combined suggest for "did you mean?": term suggest (per-word, precise)
            // + phrase suggest (full-phrase fallback for words that exist but are wrong,
            // e.g. "lightening" → "lightning"). Term suggest is preferred; phrase is
            // fallback when term has no correction.
            ...(!process.env.SEARCH_DISABLE_SPELL_CORRECT && query.length
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
      if (!process.env.SEARCH_DISABLE_SPELL_CORRECT && query.length && decodedCursor.offset === 0) {
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
