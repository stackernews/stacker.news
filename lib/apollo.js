import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client'
import { decodeCursor, LIMIT } from './cursor'
// import { RetryLink } from '@apollo/client/link/retry'

// const additiveLink = from([
//   new RetryLink(),
//   new HttpLink({ uri: '/api/graphql' })
// ])

function isFirstPage (cursor, existingThings) {
  if (cursor) {
    const decursor = decodeCursor(cursor)
    return decursor.offset === LIMIT
  } else {
    // we don't have anything cached, or our existing items are less than
    // or equal to a full page
    return existingThings?.length < LIMIT
  }
}

export default function getApolloClient () {
  if (typeof window === 'undefined') {
    const client = getClient(`${process.env.SELF_URL}/api/graphql`)
    client.clearStore()
    return client
  } else {
    global.apolloClient ||= getClient('/api/graphql')
    return global.apolloClient
  }
}

function getClient (uri) {
  return new ApolloClient({
    link: new HttpLink({ uri }),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            topUsers: {
              keyArgs: ['when', 'sort'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.users)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  users: [...(existing?.users || []), ...incoming.users]
                }
              }
            },
            items: {
              keyArgs: ['sub', 'sort', 'type', 'name', 'within'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.items)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  items: [...(existing?.items || []), ...incoming.items],
                  pins: existing?.pins || null
                }
              }
            },
            topItems: {
              keyArgs: ['sort', 'when'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.items)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  items: [...(existing?.items || []), ...incoming.items],
                  pins: existing?.pins || null
                }
              }
            },
            topComments: {
              keyArgs: ['sort', 'when'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.comments)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  comments: [...(existing?.comments || []), ...incoming.comments]
                }
              }
            },
            related: {
              keyArgs: ['id', 'title', 'limit'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.items)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  items: [...(existing?.items || []), ...incoming.items]
                }
              }
            },
            outlawedItems: {
              keyArgs: [],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.items)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  items: [...(existing?.items || []), ...incoming.items]
                }
              }
            },
            borderlandItems: {
              keyArgs: [],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.items)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  items: [...(existing?.items || []), ...incoming.items]
                }
              }
            },
            freebieItems: {
              keyArgs: [],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.items)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  items: [...(existing?.items || []), ...incoming.items]
                }
              }
            },
            search: {
              keyArgs: ['q', 'sub', 'sort', 'what', 'when'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.items)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  items: [...(existing?.items || []), ...incoming.items]
                }
              }
            },
            moreFlatComments: {
              keyArgs: ['name', 'sort', 'within'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.comments)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  comments: [...(existing?.comments || []), ...incoming.comments]
                }
              }
            },
            notifications: {
              keyArgs: ['inc'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.notifications)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  earn: existing?.earn || incoming.earn,
                  notifications: [...(existing?.notifications || []), ...incoming.notifications],
                  lastChecked: incoming.lastChecked
                }
              }
            },
            walletHistory: {
              keyArgs: ['inc'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.facts)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  facts: [...(existing?.facts || []), ...incoming.facts]
                }
              }
            }
          }
        }
      }
    }),
    defaultOptions: {
      // cache-and-network allows us to refresh pages on navigation
      watchQuery: {
        fetchPolicy: 'cache-only',
        nextFetchPolicy: 'cache-first'
      },
      query: {
        fetchPolicy: 'cache-only',
        nextFetchPolicy: 'cache-first'
      }
    }
  })
}
