import { ApolloClient, InMemoryCache } from '@apollo/client'
import { SchemaLink } from '@apollo/client/link/schema'
import { mergeSchemas } from 'graphql-tools'
import { getSession } from 'next-auth/client'
import resolvers from './resolvers'
import typeDefs from './typeDefs'
import models from './models'
import { print } from 'graphql'
import lnd from './lnd'
import search from './search'
import { ME } from '../fragments/users'
import { getPrice } from '../components/price'

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
        lnd,
        search
      }
    }),
    cache: new InMemoryCache()
  })
}

export function getGetServerSideProps (query, variables = null, foundField, requireVar) {
  return async function ({ req, query: params }) {
    const client = await getSSRApolloClient(req)
    const vars = { ...params, ...variables }

    if (requireVar && !vars[requireVar]) {
      return {
        notFound: true
      }
    }

    const { error, data } = await client.query({
      query,
      variables: vars
    })

    if (error || !data || (foundField && !data[foundField])) {
      return {
        notFound: true
      }
    }

    const { data: { me } } = await client.query({
      query: ME
    })

    const price = await getPrice()

    return {
      props: {
        apollo: {
          query: print(query),
          variables: { ...params, ...variables }
        },
        me,
        price,
        data
      }
    }
  }
}
