import { ApolloClient, InMemoryCache, from, HttpLink } from '@apollo/client'
import { decodeCursor, LIMIT } from './cursor'
import { RetryLink } from '@apollo/client/link/retry'

const additiveLink = from([
  new RetryLink(),
  new HttpLink({ uri: '/api/graphql' })
])

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
  global.apolloClient ||= new ApolloClient({
    link: additiveLink,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            topUsers: {
              keyArgs: ['within'],
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
              keyArgs: ['sub', 'sort', 'name', 'within'],
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
            search: {
              keyArgs: ['q'],
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
              keyArgs: false,
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.notifications)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
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

  return global.apolloClient
}
