import { ApolloClient, InMemoryCache } from '@apollo/client'
import { SchemaLink } from '@apollo/client/link/schema'
import { makeExecutableSchema } from 'graphql-tools'
import { getSession } from 'next-auth/client'
import resolvers from './resolvers'
import typeDefs from './typeDefs'
import models from './models'
import slashtags from './slashtags'
import { print } from 'graphql'
import lnd from './lnd'
import search from './search'
import { ME } from '../fragments/users'
import { PRICE } from '../fragments/price'

export default async function getSSRApolloClient (req, me = null) {
  const session = req && await getSession({ req })
  const client = new ApolloClient({
    ssrMode: true,
    link: new SchemaLink({
      schema: makeExecutableSchema({
        typeDefs,
        resolvers
      }),
      context: {
        models,
        me: session
          ? session.user
          : me,
        lnd,
        search,
        slashtags
      }
    }),
    cache: new InMemoryCache()
  })
  await client.clearStore()
  return client
}

export function getGetServerSideProps (query, variables = null, notFoundFunc, requireVar) {
  return async function ({ req, query: params }) {
    const { nodata, ...realParams } = params
    const vars = { ...realParams, ...variables }
    const client = await getSSRApolloClient(req)

    const { data: { me } } = await client.query({
      query: ME
    })

    const { data: { price } } = await client.query({
      query: PRICE, variables: { fiatCurrency: me?.fiatCurrency }
    })

    // we want to use client-side cache
    if (nodata && query) {
      return {
        props: {
          me,
          price,
          apollo: {
            query: print(query),
            variables: vars
          }
        }
      }
    }

    if (requireVar && !vars[requireVar]) {
      return {
        notFound: true
      }
    }

    let error = null; let data = null; let props = {}
    if (query) {
      ({ error, data } = await client.query({
        query,
        variables: vars
      }))

      if (error || !data || (notFoundFunc && notFoundFunc(data))) {
        return {
          notFound: true
        }
      }

      props = {
        apollo: {
          query: print(query),
          variables: vars
        }
      }
    }

    return {
      props: {
        ...props,
        me,
        price,
        data
      }
    }
  }
}
