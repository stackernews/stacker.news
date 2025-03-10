import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { whenToFrom } from '@/lib/time'
import { getItem, itemQueryWithMeta, SELECT } from './item'

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

export default {
  Query: {
    related: async (parent, { title, id, cursor, limit = LIMIT, minMatch }, { me, models, search }) => {
      const decodedCursor = decodeCursor(cursor)

      if (!id && (!title || title.trim().split(/\s+/).length < 1)) {
        return {
          items: [],
          cursor: null
        }
      }

      const like = []
      if (id) {
        like.push({
          _index: process.env.OPENSEARCH_INDEX,
          _id: id
        })
      }

      if (title) {
        like.push(title)
      }

      const mustNot = [{ exists: { field: 'parentId' } }]
      if (id) {
        mustNot.push({ term: { id } })
      }

      let should = [
        {
          more_like_this: {
            fields: ['title', 'text'],
            like,
            min_term_freq: 1,
            min_doc_freq: 1,
            max_doc_freq: 5,
            min_word_length: 2,
            max_query_terms: 25,
            minimum_should_match: minMatch || '10%',
            boost_terms: 100
          }
        }
      ]

      if (process.env.OPENSEARCH_MODEL_ID) {
        let qtitle = title
        let qtext = title
        if (id) {
          const item = await getItem(parent, { id }, { me, models })
          qtitle = item.title || item.text
          qtext = item.text || item.title
        }

        should = [
          {
            neural: {
              title_embedding: {
                query_text: qtext,
                model_id: process.env.OPENSEARCH_MODEL_ID,
                k: decodedCursor.offset + LIMIT
              }
            }
          },
          {
            neural: {
              text_embedding: {
                query_text: qtitle,
                model_id: process.env.OPENSEARCH_MODEL_ID,
                k: decodedCursor.offset + LIMIT
              }
            }
          }
        ]
      }

      const results = await search.search({
        index: process.env.OPENSEARCH_INDEX,
        size: limit,
        from: decodedCursor.offset,
        _source: {
          excludes: [
            'text',
            'text_embedding',
            'title_embedding'
          ]
        },
        body: {
          query: {
            function_score: {
              query: {
                bool: {
                  should,
                  filter: [
                    {
                      bool: {
                        should: [
                          { match: { status: 'ACTIVE' } },
                          { match: { status: 'NOSATS' } }
                        ],
                        must_not: mustNot
                      }
                    },
                    {
                      range: { wvotes: { gte: minMatch ? 0 : 0.2 } }
                    }
                  ]
                }
              },
              functions: [{
                field_value_factor: {
                  field: 'wvotes',
                  modifier: 'none',
                  factor: 1,
                  missing: 0
                }
              }],
              boost_mode: 'multiply'
            }
          }
        }
      })

      const values = results.body.hits.hits.map((e, i) => {
        return `(${e._source.id}, ${i})`
      }).join(',')

      if (values.length === 0) {
        return {
          cursor: null,
          items: []
        }
      }

      const items = await itemQueryWithMeta({
        me,
        models,
        query: `
          WITH r(id, rank) AS (VALUES ${values})
          ${SELECT}, rank
          FROM "Item"
          JOIN r ON "Item".id = r.id`,
        orderBy: 'ORDER BY rank ASC'
      })

      return {
        cursor: items.length === (limit || LIMIT) ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    search: async (parent, { q, cursor, sort, what, when, from: whenFrom, to: whenTo }, { me, models, search }) => {
      const decodedCursor = decodeCursor(cursor)
      let sitems = null

      // short circuit: return empty result if either:
      // 1. no query provided, or
      // 2. searching bookmarks without being authed
      if (!q || (what === 'bookmarks' && !me)) {
        return {
          items: [],
          cursor: null
        }
      }

      // build query in parts:
      //   filters: determine the universe of potential search candidates
      //   termQueries: queries related to the actual search terms
      //   functions: rank modifiers to boost by recency or popularity
      const filters = []
      const termQueries = []
      const functions = []

      // filters for item types
      switch (what) {
        case 'posts': // posts only
          filters.push({ bool: { must_not: { exists: { field: 'parentId' } } } })
          break
        case 'comments': // comments only
          filters.push({ bool: { must: { exists: { field: 'parentId' } } } })
          break
        case 'bookmarks':
          if (me?.id) {
            filters.push({ match: { bookmarkedBy: me?.id } })
          }
      }

      // filter for active posts
      filters.push(
        me
          ? {
              bool: {
                should: [
                  { match: { status: 'ACTIVE' } },
                  { match: { status: 'NOSATS' } },
                  { match: { userId: me.id } }
                ]
              }
            }
          : {
              bool: {
                should: [
                  { match: { status: 'ACTIVE' } },
                  { match: { status: 'NOSATS' } }
                ]
              }
            }
      )

      // filter for time range
      const whenRange = when === 'custom'
        ? {
            gte: whenFrom,
            lte: new Date(Math.min(new Date(Number(whenTo)), decodedCursor.time))
          }
        : {
            lte: decodedCursor.time,
            gte: whenToFrom(when)
          }
      filters.push({ range: { createdAt: whenRange } })

      // filter for non negative wvotes
      filters.push({ range: { wvotes: { gte: 0 } } })

      // decompose the search terms
      const { query: _query, quotes, nym, url, territory } = queryParts(q)
      let query = _query

      // if search contains a url term, modify the query text
      const isUrlSearch = url && query.length === 0
      if (url) {
        const isFQDN = url.startsWith('url:www.')
        const domain = isFQDN ? url.slice(8) : url.slice(4)
        const fqdn = `www.${domain}`
        query = (isUrlSearch) ? `${domain} ${fqdn}` : `${query.trim()} ${domain}`
      }

      // if nym, items must contain nym
      if (nym) {
        termQueries.push({ wildcard: { 'user.name': `*${nym.slice(1).toLowerCase()}*` } })
      }

      // if territory, item must be from territory
      if (territory) {
        termQueries.push({ match: { 'sub.name': territory.slice(1) } })
      }

      // if quoted phrases, items must contain entire phrase
      for (const quote of quotes) {
        termQueries.push({
          multi_match: {
            query: quote,
            type: 'phrase',
            fields: ['title', 'text']
          }
        })
      }

      // query for search terms
      if (query.length) {
        // keyword based subquery, to be used on its own or in conjunction with a neural
        // search
        const subquery = {
          multi_match: {
            query,
            type: 'most_fields',
            fields: ['title^20', 'text'],
            minimum_should_match: (isUrlSearch) ? 1 : '60%'
          }
        }

        // use hybrid neural search if model id is available, otherwise use only
        // keyword search
        if (process.env.OPENSEARCH_MODEL_ID) {
          termQueries.push({
            hybrid: {
              queries: [
                {
                  bool: {
                    should: [
                      {
                        neural: {
                          title_embedding: {
                            query_text: query,
                            model_id: process.env.OPENSEARCH_MODEL_ID,
                            k: decodedCursor.offset + LIMIT
                          }
                        }
                      },
                      {
                        neural: {
                          text_embedding: {
                            query_text: query,
                            model_id: process.env.OPENSEARCH_MODEL_ID,
                            k: decodedCursor.offset + LIMIT
                          }
                        }
                      }
                    ]
                  }
                },
                {
                  bool: {
                    should: subquery
                  }
                }
              ]
            }
          })
        } else {
          termQueries.push(subquery)
        }
      }

      // functions for boosting search rank by recency or popularity
      switch (sort) {
        case 'comments':
          functions.push({
            field_value_factor: {
              field: 'ncomments',
              modifier: 'none'
            }
          })
          break
        case 'sats':
          functions.push({
            field_value_factor: {
              field: 'sats',
              modifier: 'log1p'
            }
          })
          break
        case 'recent':
          functions.push({
            gauss: {
              createdAt: {
                origin: 'now',
                scale: '7d',
                decay: 0.5
              }
            }
          })
          break
        case 'zaprank':
          functions.push({
            field_value_factor: {
              field: 'wvotes',
              modifier: 'log1p'
            }
          })
          break
      }

      try {
        sitems = await search.search({
          index: process.env.OPENSEARCH_INDEX,
          size: LIMIT,
          _source: {
            excludes: [
              'text',
              'text_embedding',
              'title_embedding'
            ]
          },
          from: decodedCursor.offset,
          body: {
            query: {
              function_score: {
                query: {
                  bool: {
                    filter: filters,
                    must: termQueries
                  }
                },
                functions,
                score_mode: 'multiply',
                boost_mode: 'multiply'
              }
            },
            highlight: {
              fields: {
                title: { number_of_fragments: 0, pre_tags: ['***'], post_tags: ['***'] },
                text: { number_of_fragments: 5, order: 'score', pre_tags: ['***'], post_tags: ['***'] }
              }
            }
          }
        })
      } catch (e) {
        console.log(e)
        return {
          cursor: null,
          items: []
        }
      }

      const values = sitems.body.hits.hits.map((e, i) => {
        return `(${e._source.id}, ${i})`
      }).join(',')

      if (values.length === 0) {
        return {
          cursor: null,
          items: []
        }
      }

      const items = (await itemQueryWithMeta({
        me,
        models,
        query: `
          WITH r(id, rank) AS (VALUES ${values})
          ${SELECT}, rank
          FROM "Item"
          JOIN r ON "Item".id = r.id`,
        orderBy: 'ORDER BY rank ASC, msats DESC'
      })).map((item, i) => {
        const e = sitems.body.hits.hits[i]
        item.searchTitle = (e.highlight?.title && e.highlight.title[0]) || item.title
        item.searchText = (e.highlight?.text && e.highlight.text.join(' ... ')) || undefined
        return item
      })

      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    }
  }
}
