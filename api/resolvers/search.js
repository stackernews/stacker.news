import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { whenToFrom } from '../../lib/time'
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
  'interesting', 'us', 'welcome']

export default {
  Query: {
    related: async (parent, { title, id, cursor, limit, minMatch }, { me, models, search }) => {
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
              must: [
                {
                  more_like_this: {
                    fields: ['title'],
                    like: title,
                    min_term_freq: 1,
                    min_doc_freq: 1,
                    min_word_length: 2,
                    max_query_terms: 25,
                    minimum_should_match: minMatch || '20%',
                    stop_words: STOP_WORDS
                  }
                }
              ],
              must_not: [{ exists: { field: 'parentId' } }, ...mustNot],
              filter: {
                range: { wvotes: { gte: minMatch ? 0 : 0.2 } }
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
    search: async (parent, { q: query, sub, cursor, sort, what, when, from: whenFrom, to: whenTo }, { me, models, search }) => {
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
      const exclude = [url, nym]
      query = queryArr.filter(word => !exclude.includes(word)).join(' ')

      if (url) {
        whatArr.push({ match_phrase_prefix: { url: `${url.slice(4).toLowerCase()}` } })
      }

      if (nym) {
        whatArr.push({ wildcard: { 'user.name': `*${nym.slice(4).toLowerCase()}*` } })
      }

      if (sub) {
        whatArr.push({ match: { 'sub.name': sub } })
      }

      let sortField
      switch (sort) {
        case 'comments':
          sortField = 'ncomments'
          break
        case 'sats':
          sortField = 'sats'
          break
        default:
          sortField = 'wvotes'
          break
      }

      if (query.length) {
        whatArr.push({
          bool: {
            should: [
              {
              // all terms are matched in fields
                multi_match: {
                  query,
                  type: 'most_fields',
                  fields: ['title^1000', 'text'],
                  minimum_should_match: '100%',
                  boost: 1000
                }
              },
              {
                // all terms are matched in fields fuzzily
                multi_match: {
                  query,
                  type: 'most_fields',
                  fields: ['title^1000', 'text'],
                  fuzziness: 'AUTO',
                  prefix_length: 3,
                  minimum_should_match: '100%',
                  boost: 10
                }
              },
              {
                // only some terms must match unless we're sorting
                multi_match: {
                  query,
                  type: 'most_fields',
                  fields: ['title^1000', 'text'],
                  fuzziness: 'AUTO',
                  prefix_length: 3,
                  minimum_should_match: '60%'
                }
              }
            ]
          }
        })
      }

      const whenRange = when === 'custom'
        ? {
            gte: whenFrom,
            lte: new Date(Math.min(new Date(whenTo), decodedCursor.time))
          }
        : {
            lte: decodedCursor.time,
            gte: whenToFrom(when)
          }

      try {
        sitems = await search.search({
          index: 'item',
          size: LIMIT,
          from: decodedCursor.offset,
          body: {
            query: {
              function_score: {
                query: {
                  bool: {
                    must: [
                      ...whatArr,
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
                    filter: [
                      {
                        range:
                        {
                          createdAt: whenRange
                        }
                      },
                      { range: { wvotes: { gte: 0 } } }
                    ]
                  }
                },
                field_value_factor: {
                  field: sortField,
                  modifier: sort === 'comments' ? 'square' : 'log2p',
                  factor: 1.2
                },
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

      // return highlights
      const items = sitems.body.hits.hits.map(async e => {
        // this is super inefficient but will suffice until we do something more generic
        const item = await getItem(parent, { id: e._source.id }, { me, models })

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
