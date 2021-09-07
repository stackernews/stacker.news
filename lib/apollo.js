import { ApolloClient, InMemoryCache, from, HttpLink } from '@apollo/client'
import { isFirstPage } from './cursor'
import { RetryLink } from '@apollo/client/link/retry'

const additiveLink = from([
  new RetryLink(),
  new HttpLink({ uri: '/api/graphql' })
])

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
              if (incoming.cursor && isFirstPage(incoming.cursor)) {
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
              if (incoming.cursor && isFirstPage(incoming.cursor)) {
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
              if (incoming.cursor && isFirstPage(incoming.cursor)) {
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
