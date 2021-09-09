import { ApolloClient, InMemoryCache, from, HttpLink } from '@apollo/client'
import { decodeCursor, LIMIT } from './cursor'
import { RetryLink } from '@apollo/client/link/retry'

const additiveLink = from([
  new RetryLink(),
  new HttpLink({ uri: '/api/graphql' })
])

function isFirstPage (cursor, existing) {
  if (cursor) {
    const decursor = decodeCursor(cursor)
    return decursor.offset === LIMIT
  } else {
    // we don't have anything cached, or our existing items are less than
    // or equal to a full page TODO test for off by one
    return !existing || !existing.items || existing.items.length < LIMIT
  }
}

export default new ApolloClient({
  uri: '/api/graphql',
  link: additiveLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          moreItems: {
            keyArgs: ['sort', 'userId'],
            merge (existing, incoming) {
              if (isFirstPage(incoming.cursor, existing)) {
                return incoming
              }

              return {
                cursor: incoming.cursor,
                items: [...(existing?.items || []), ...incoming.items]
              }
            }
          },
          moreFlatComments: {
            keyArgs: ['userId'],
            merge (existing, incoming) {
              if (isFirstPage(incoming.cursor, existing)) {
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
              if (isFirstPage(incoming.cursor, existing)) {
                return incoming
              }

              return {
                cursor: incoming.cursor,
                notifications: [...(existing?.notifications || []), ...incoming.notifications],
                lastChecked: incoming.lastChecked
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
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first'
    }
  }
})
