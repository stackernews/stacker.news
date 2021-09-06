import { ApolloClient, InMemoryCache } from '@apollo/client'
import { isFirstPage } from './cursor'

export default new ApolloClient({
  uri: '/api/graphql',
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
