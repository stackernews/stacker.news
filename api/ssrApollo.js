import { ApolloClient, InMemoryCache } from '@apollo/client'
import { SchemaLink } from '@apollo/client/link/schema'
import { makeExecutableSchema } from '@graphql-tools/schema'
import resolvers from './resolvers'
import typeDefs from './typeDefs'
import models from './models'
import slashtags from './slashtags'
import { print } from 'graphql'
import lnd from './lnd'
import search from './search'
import { ME } from '../fragments/users'
import { PRICE } from '../fragments/price'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../pages/api/auth/[...nextauth]'

export default async function getSSRApolloClient ({ req, res, me = null }) {
  const session = req && await getServerSession(req, res, getAuthOptions(req))
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
    cache: new InMemoryCache({
      freezeResults: true
    }),
    assumeImmutableResults: true,
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
        nextFetchPolicy: 'no-cache',
        canonizeResults: true,
        ssr: true
      },
      query: {
        fetchPolicy: 'no-cache',
        nextFetchPolicy: 'no-cache',
        canonizeResults: true,
        ssr: true
      }
    }
  })
  return client
}

export function getGetServerSideProps (queryOrFunc, variablesOrFunc = null, notFoundFunc, requireVar) {
  return async function ({ req, res, query: params }) {
    const { nodata, ...realParams } = params
    // we want to use client-side cache
    if (nodata) return { props: { } }

    const variables = typeof variablesOrFunc === 'function' ? variablesOrFunc(realParams) : variablesOrFunc
    const vars = { ...realParams, ...variables }
    const query = typeof queryOrFunc === 'function' ? queryOrFunc(vars) : queryOrFunc

    const client = await getSSRApolloClient({ req, res })

    const { data: { me } } = await client.query({
      query: ME,
      variables: { skipUpdate: true }
    })

    const { data: { price } } = await client.query({
      query: PRICE, variables: { fiatCurrency: me?.fiatCurrency }
    })

    if (requireVar && !vars[requireVar]) {
      return {
        notFound: true
      }
    }

    let error = null; let data = null; let props = {}
    if (query) {
      try {
        ({ error, data } = await client.query({
          query,
          variables: vars
        }))
      } catch (err) {
        if (err.message === 'you must be logged in') {
          const callback = process.env.PUBLIC_URL + req.url
          return {
            redirect: {
              destination: `/login?callbackUrl=${encodeURIComponent(callback)}`
            }
          }
        }
        throw err
      }

      if (error || !data || (notFoundFunc && notFoundFunc(data, vars))) {
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
        ssrData: data
      }
    }
  }
}
