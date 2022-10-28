import { ITEM_FILTER_THRESHOLD } from '../../lib/constants'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { getItem } from './item'

const STOP_WORDS = ['a', 'an', 'and', 'are', 'as', 'at', 'be', 'but',
  'by', 'for', 'if', 'in', 'into', 'is', 'it', 'no', 'not',
  'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then',
  'there', 'these', 'they', 'this', 'to', 'was', 'will',
  'with', 'bitcoin', 'page', 'adds', 'how', 'why', 'what',
  'works', 'now', 'available', 'breaking', 'app', 'powered',
  'just', 'dev', 'using', 'crypto', 'has', 'my', 'i', 'apps',
  'really', 'new', 'era', 'application', 'best', 'year',
  'latest', 'still', 'few', 'crypto', 'keep', 'public', 'current',
  'levels', 'from', 'cryptocurrencies', 'confirmed', 'news', 'network',
  'about', 'sources', 'vote', 'considerations', 'hope',
  'keep', 'keeps', 'including', 'we', 'brings', "don't", 'do',
  'interesting', 'us']

export default {
  Query: {
    related: async (parent, { title, id, cursor, limit }, { me, models, search }) => {
      const decodedCursor = decodeCursor(cursor)
      if (!title || title.trim().split(/\s+/).length < 1) {
        if (id) {
          const item = await getItem(parent, { id }, { me, models })
          title = item?.title
        }
        if (!title) {
          return {
            items: [],
            cursor: null
          }
        }
      }

      const mustNot = []
      if (id) {
        mustNot.push({ term: { id } })
      }

      let items = await search.search({
        index: 'item',
        size: limit || LIMIT,
        from: decodedCursor.offset,
        body: {
          query: {
            bool: {
              should: [
                {
                  more_like_this: {
                    fields: ['title'],
                    like: title,
                    min_term_freq: 1,
                    min_doc_freq: 1,
                    max_query_terms: 25,
                    min_word_length: 2,
                    minimum_should_match: '50%',
                    stop_words: STOP_WORDS,
                    boost: 400
                  }
                },
                {
                  more_like_this: {
                    fields: ['title'],
                    like: title,
                    min_term_freq: 1,
                    min_doc_freq: 1,
                    min_word_length: 2,
                    max_query_terms: 25,
                    minimum_should_match: '30%',
                    stop_words: STOP_WORDS
                  }
                }
              ],
              must_not: [{ exists: { field: 'parentId' } }, ...mustNot],
              filter: {
                range: { wvotes: { gte: 0.2 } }
              }
            }
          },
          sort: ['_score', { wvotes: 'desc' }, { sats: 'desc' }]
        }
      })

      items = items.body.hits.hits.map(async e => {
        // this is super inefficient but will suffice until we do something more generic
        return await getItem(parent, { id: e._source.id }, { me, models })
      })

      return {
        cursor: items.length === (limit || LIMIT) ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    search: async (parent, { q: query, sub, cursor, sort, what, when }, { me, models, search }) => {
      const decodedCursor = decodeCursor(cursor)
      let sitems

      if (!query) {
        return {
          items: [],
          cursor: null
        }
      }

      const whatArr = []
      switch (what) {
        case 'posts':
          whatArr.push({ bool: { must_not: { exists: { field: 'parentId' } } } })
          break
        case 'comments':
          whatArr.push({ bool: { must: { exists: { field: 'parentId' } } } })
          break
        default:
          break
      }

      const queryArr = query.trim().split(/\s+/)
      const url = queryArr.find(word => word.startsWith('url:'))
      const nym = queryArr.find(word => word.startsWith('nym:'))
      query = queryArr.filter(word => !word.startsWith('url:') && !word.startsWith('nym:')).join(' ')

      if (url) {
        whatArr.push({ wildcard: { url: `*${url.slice(4).toLowerCase()}*` } })
      }

      if (nym) {
        whatArr.push({ wildcard: { 'user.name': `*${nym.slice(4).toLowerCase()}*` } })
      }

      const sortArr = []
      switch (sort) {
        case 'recent':
          sortArr.push({ createdAt: 'desc' })
          break
        case 'comments':
          sortArr.push({ ncomments: 'desc' })
          break
        case 'sats':
          sortArr.push({ sats: 'desc' })
          break
        case 'votes':
          sortArr.push({ upvotes: 'desc' })
          break
        default:
          break
      }
      sortArr.push('_score')

      if (query.length) {
        whatArr.push({
          bool: {
            should: [
              {
              // all terms are matched in fields
                multi_match: {
                  query,
                  type: 'most_fields',
                  fields: ['title^20', 'text'],
                  minimum_should_match: '100%',
                  boost: 400
                }
              },
              {
                // all terms are matched in fields
                multi_match: {
                  query,
                  type: 'most_fields',
                  fields: ['title^20', 'text'],
                  fuzziness: 'AUTO',
                  prefix_length: 3,
                  minimum_should_match: '100%',
                  boost: 20
                }
              },
              {
                // only some terms must match unless we're sorting
                multi_match: {
                  query,
                  type: 'most_fields',
                  fields: ['title^20', 'text'],
                  fuzziness: 'AUTO',
                  prefix_length: 3,
                  minimum_should_match: sortArr.length > 1 ? '100%' : '60%'
                }
              }
            ]
          }
        })
      }

      let whenGte
      switch (when) {
        case 'day':
          whenGte = 'now-1d'
          break
        case 'week':
          whenGte = 'now-7d'
          break
        case 'month':
          whenGte = 'now-30d'
          break
        case 'year':
          whenGte = 'now-365d'
          break
        default:
          break
      }

      try {
        sitems = await search.search({
          index: 'item',
          size: LIMIT,
          from: decodedCursor.offset,
          body: {
            query: {
              bool: {
                must: [
                  ...whatArr,
                  sub
                    ? { match: { 'sub.name': sub } }
                    : { bool: { must_not: { exists: { field: 'sub.name' } } } },
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
                ],
                filter: {
                  range: {
                    createdAt: {
                      lte: decodedCursor.time,
                      gte: whenGte
                    },
                    wvotes: { gt: -1 * ITEM_FILTER_THRESHOLD }
                  }
                }
              }
            },
            sort: sortArr,
            highlight: {
              fields: {
                title: { number_of_fragments: 0, pre_tags: [':high['], post_tags: [']'] },
                text: { number_of_fragments: 0, pre_tags: [':high['], post_tags: [']'] }
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

      // return highlights
      const items = sitems.body.hits.hits.map(async e => {
        // this is super inefficient but will suffice until we do something more generic
        const item = await getItem(parent, { id: e._source.id }, { me, models })

        item.searchTitle = (e.highlight?.title && e.highlight.title[0]) || item.title
        item.searchText = (e.highlight?.text && e.highlight.text[0]) || item.text

        return item
      })

      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    }
  }
}
