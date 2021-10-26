import { ApolloClient, InMemoryCache } from '@apollo/client'
import { SchemaLink } from '@apollo/client/link/schema'
import { mergeSchemas } from 'graphql-tools'
import { getSession } from 'next-auth/client'
import resolvers from './resolvers'
import typeDefs from './typeDefs'
import models from './models'
import { print } from 'graphql'

export default async function getSSRApolloClient (req) {
  const session = req && await getSession({ req })
  return new ApolloClient({
    ssrMode: true,
    link: new SchemaLink({
      schema: mergeSchemas({
        schemas: typeDefs,
        resolvers: resolvers
      }),
      context: {
        models,
        me: session ? session.user : null
      }
    }),
    cache: new InMemoryCache()
  })
}

export function getGetServerSideProps (query, variables = null) {
  return async function ({ req, params }) {
    const client = await getSSRApolloClient(req)
    const { error, data } = await client.query({
      query,
      variables: { ...params, ...variables }
    })

    if (error || !data) {
      return {
        notFound: true
      }
    }

    return {
      props: {
        apollo: {
          query: print(query),
          variables: { ...params, ...variables }
        },
        data
      }
    }
  }
}
