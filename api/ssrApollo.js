import { ApolloClient, InMemoryCache } from '@apollo/client'
import { SchemaLink } from '@apollo/client/link/schema'
import { makeExecutableSchema } from '@graphql-tools/schema'
import resolvers from './resolvers'
import typeDefs from './typeDefs'
import models from './models'
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
        search
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

/**
 * Takes a query and variables and returns a getServerSideProps function
 *
 * @param opts Options
 * @param opts.query graphql query or function that return graphql query
 * @param opts.variables graphql variables or function that return graphql variables
 * @param opts.notFound function that tests data to determine if 404
 * @param opts.authRequired boolean that determines if auth is required
 */
export function getGetServerSideProps ({ query, variables, notFound, authRequired }) {
  return async function ({ req, res, query: params }) {
    const { nodata, ...realParams } = params
    // we want to use client-side cache
    if (nodata) return { props: { } }

    variables = typeof variables === 'function' ? variables(realParams) : variables
    const vars = { ...realParams, ...variables }
    query = typeof query === 'function' ? query(vars) : query

    const client = await getSSRApolloClient({ req, res })

    const { data: { me } } = await client.query({
      query: ME,
      variables: { skipUpdate: true }
    })

    if (authRequired && !me) {
      const callback = process.env.PUBLIC_URL + req.url
      return {
        redirect: {
          destination: `/login?callbackUrl=${encodeURIComponent(callback)}`
        }
      }
    }

    const { data: { price } } = await client.query({
      query: PRICE, variables: { fiatCurrency: me?.fiatCurrency }
    })

    let error = null; let data = null; let props = {}
    if (query) {
      try {
        ({ error, data } = await client.query({
          query,
          variables: vars
        }))
      } catch (e) {
        console.error(e)
      }

      if (error || !data || (notFound && notFound(data, vars))) {
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
