import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client'
import { decodeCursor, LIMIT } from './cursor'
import { SSR } from './constants'

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

const defaultFetchPolicy = SSR ? 'cache-only' : 'cache-first'
const defaultNextFetchPolicy = SSR ? 'cache-only' : 'cache-first'

export default function getApolloClient () {
  if (SSR) {
    return getClient(`${process.env.SELF_URL}/api/graphql`)
  } else {
    global.apolloClient ||= getClient('/api/graphql')
    return global.apolloClient
  }
}

function getClient (uri) {
  return new ApolloClient({
    link: new HttpLink({ uri }),
    ssrMode: SSR,
    cache: new InMemoryCache({
      freezeResults: true,
      typePolicies: {
        Query: {
          fields: {
            topUsers: {
              keyArgs: ['when', 'by'],
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
            topCowboys: {
              keyArgs: [],
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
              keyArgs: ['sub', 'sort', 'type', 'name', 'when', 'by'],
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
            comments: {
              keyArgs: ['id', 'sort'],
              merge (existing, incoming) {
                return incoming
              }
            },
            related: {
              keyArgs: ['id', 'title', 'minMatch', 'limit'],
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
            searchUsers: {
              keyArgs: ['q', 'limit', 'similarity'],
              merge (existing, incoming) {
                return [...(existing?.searchUsers || []), ...incoming]
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
                  lastChecked: existing?.lastChecked || incoming.lastChecked
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
        },
        Item: {
          fields: {
            meAnonSats: {
              read (meAnonSats, { readField }) {
                if (typeof window === 'undefined') return null
                const itemId = readField('id')
                return meAnonSats ?? Number(window.localStorage.getItem(`TIP-item:${itemId}`) || '0')
              }
            }
          }
        }
      }
    }),
    assumeImmutableResults: true,
    defaultOptions: {
      watchQuery: {
        initialFetchPolicy: defaultFetchPolicy,
        fetchPolicy: defaultFetchPolicy,
        nextFetchPolicy: defaultNextFetchPolicy,
        canonizeResults: true,
        ssr: SSR
      },
      query: {
        initialFetchPolicy: defaultFetchPolicy,
        fetchPolicy: defaultFetchPolicy,
        nextFetchPolicy: defaultNextFetchPolicy,
        canonizeResults: true,
        ssr: SSR
      }
    }
  })
}
