import { ApolloClient, InMemoryCache } from '@apollo/client'
import { SchemaLink } from '@apollo/client/link/schema'
import { makeExecutableSchema } from '@graphql-tools/schema'
import resolvers from './resolvers'
import typeDefs from './typeDefs'
import models from './models'
import { print } from 'graphql'
import lnd from './lnd'
import search from './search'
import { ME } from '@/fragments/users'
import { PRICE } from '@/fragments/price'
import { BLOCK_HEIGHT } from '@/fragments/blockHeight'
import { CHAIN_FEE } from '@/fragments/chainFee'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '@/pages/api/auth/[...nextauth]'
import { NOFOLLOW_LIMIT } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { MULTI_AUTH_ANON, MULTI_AUTH_LIST } from '@/lib/auth'

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
        ssr: true
      },
      query: {
        fetchPolicy: 'no-cache',
        nextFetchPolicy: 'no-cache',
        ssr: true
      }
    }
  })

  await client.clearStore()
  return client
}

function oneDayReferral (request, { me }) {
  if (!me) return
  const refHeader = request.headers['x-stacker-news-referrer']
  if (!refHeader) return

  const referrers = refHeader.split('; ').filter(Boolean)
  for (const referrer of referrers) {
    let prismaPromise, getData

    if (referrer.startsWith('item-')) {
      prismaPromise = models.item.findUnique({
        where: {
          id: parseInt(referrer.slice(5)),
          msats: {
            gt: satsToMsats(NOFOLLOW_LIMIT)
          },
          weightedVotes: {
            gt: 0
          }
        }
      })
      getData = item => ({
        referrerId: item.userId,
        refereeId: parseInt(me.id),
        type: item.parentId ? 'COMMENT' : 'POST',
        typeId: String(item.id)
      })
    } else if (referrer.startsWith('profile-')) {
      const name = referrer.slice(8)
      // exclude all pages that are not user profiles
      if (['api', 'auth', 'day', 'invites', 'invoices', 'referrals', 'rewards',
        'satistics', 'settings', 'stackers', 'wallet', 'withdrawals', '404', '500',
        'email', 'live', 'login', 'notifications', 'offline', 'search', 'share',
        'signup', 'territory', 'recent', 'top', 'edit', 'post', 'rss', 'saloon',
        'faq', 'story', 'privacy', 'copyright', 'tos', 'changes', 'guide', 'daily',
        'anon', 'ad'].includes(name)) continue

      prismaPromise = models.user.findUnique({ where: { name } })
      getData = user => ({
        referrerId: user.id,
        refereeId: parseInt(me.id),
        type: 'PROFILE',
        typeId: String(user.id)
      })
    } else if (referrer.startsWith('territory-')) {
      prismaPromise = models.sub.findUnique({ where: { name: referrer.slice(10) } })
      getData = sub => ({
        referrerId: sub.userId,
        refereeId: parseInt(me.id),
        type: 'TERRITORY',
        typeId: sub.name
      })
    } else {
      prismaPromise = models.user.findUnique({ where: { name: referrer } })
      getData = user => ({
        referrerId: user.id,
        refereeId: parseInt(me.id),
        type: 'REFERRAL',
        typeId: String(user.id)
      })
    }

    prismaPromise?.then(ref => {
      if (ref && getData) {
        const data = getData(ref)
        // can't refer yourself
        if (data.refereeId === data.referrerId) return
        models.oneDayReferral.create({ data }).catch(console.error)
      }
    }).catch(console.error)
  }
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
export function getGetServerSideProps (
  { query: queryOrFunc, variables: varsOrFunc, notFound, authRequired }) {
  return async function ({ req, res, query: params }) {
    const { nodata, ...realParams } = params
    // we want to use client-side cache
    if (nodata) return { props: { } }

    const variables = typeof varsOrFunc === 'function' ? varsOrFunc(realParams) : varsOrFunc
    const vars = { ...realParams, ...variables }
    const query = typeof queryOrFunc === 'function' ? queryOrFunc(vars) : queryOrFunc

    const client = await getSSRApolloClient({ req, res })

    // custom domain SSR check
    const customDomain = req.headers.host !== process.env.NEXT_PUBLIC_URL.replace(/^https?:\/\//, '')

    let { data: { me } } = await client.query({ query: ME })

    // required to redirect to /signup on page reload
    // if we switched to anon and authentication is required
    if (req.cookies[MULTI_AUTH_LIST] === MULTI_AUTH_ANON) {
      me = null
    }

    if (authRequired && !me) {
      let callback = process.env.NEXT_PUBLIC_URL + req.url
      // On client-side routing, the callback is a NextJS URL
      // so we need to remove the NextJS stuff.
      // Example: /_next/data/development/territory.json
      callback = callback.replace(/\/_next\/data\/\w+\//, '/').replace(/\.json$/, '')
      return {
        redirect: {
          destination: `/signup?callbackUrl=${encodeURIComponent(callback)}`
        }
      }
    }

    const { data: { price } } = await client.query({
      query: PRICE, variables: { fiatCurrency: me?.privates?.fiatCurrency }
    })

    const { data: { blockHeight } } = await client.query({
      query: BLOCK_HEIGHT, variables: {}
    })

    const { data: { chainFee } } = await client.query({
      query: CHAIN_FEE, variables: {}
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

      if (error || !data || (notFound && notFound(data, vars, me))) {
        error && console.error(error)
        res.writeHead(302, {
          Location: '/404'
        }).end()
      }

      props = {
        apollo: {
          query: print(query),
          variables: vars
        }
      }
    }

    oneDayReferral(req, { me })

    return {
      props: {
        ...props,
        customDomain,
        me,
        price,
        blockHeight,
        chainFee,
        ssrData: data
      }
    }
  }
}
