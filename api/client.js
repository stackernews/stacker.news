import { ApolloClient, InMemoryCache } from '@apollo/client'
import { SchemaLink } from '@apollo/client/link/schema'
import { mergeSchemas } from 'graphql-tools'
import { getSession } from 'next-auth/client'
import resolvers from './resolvers'
import typeDefs from './typeDefs'
import models from './models'

const client = new ApolloClient({
  ssrMode: true,
  // Instead of "createHttpLink" use SchemaLink here
  link: new SchemaLink({
    schema: mergeSchemas({
      schemas: typeDefs,
      resolvers: resolvers
    }),
    context: async ({ req }) => {
      const session = await getSession({ req })
      return {
        models,
        me: session ? session.user : null
      }
    }
  }),
  cache: new InMemoryCache()
})

export default client
