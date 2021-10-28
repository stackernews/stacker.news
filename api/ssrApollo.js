import { ApolloClient, InMemoryCache } from '@apollo/client'
import { SchemaLink } from '@apollo/client/link/schema'
import { mergeSchemas } from 'graphql-tools'
import { getSession } from 'next-auth/client'
import resolvers from './resolvers'
import typeDefs from './typeDefs'
import models from './models'
import { print } from 'graphql'
import lnd from './lnd'

export default async function getSSRApolloClient (req, me = null) {
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
        me: session ? session.user : me,
        lnd
      }
    }),
    cache: new InMemoryCache()
  })
}

export function getGetServerSideProps (query, variables = null, foundField) {
  return async function ({ req, params }) {
    const client = await getSSRApolloClient(req)
    const { error, data } = await client.query({
      query,
      variables: { ...params, ...variables }
    })

    if (error || !data || (foundField && !data[foundField])) {
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
