import { ApolloServer } from '@apollo/server'
import { startServerAndCreateNextHandler } from '@as-integrations/next'
import resolvers from '@/api/resolvers'
import models from '@/api/models'
import lnd from '@/api/lnd'
import typeDefs from '@/api/typeDefs'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from './auth/[...nextauth]'
import search from '@/api/search'
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault
} from '@apollo/server/plugin/landingPage/default'
import { multiAuthMiddleware } from '@/lib/auth'
import { depthLimit } from '@graphile/depth-limit'
import { COMMENT_DEPTH_LIMIT } from '@/lib/constants'

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  allowBatchedHttpRequests: true,
  validationRules: [depthLimit({
    revealDetails: true,
    maxListDepth: COMMENT_DEPTH_LIMIT,
    maxDepth: 20,
    maxIntrospectionDepth: 20,
    maxDepthByFieldCoordinates: {
      '__Type.ofType': 20,
      'Item.comments': COMMENT_DEPTH_LIMIT,
      'Comments.comments': COMMENT_DEPTH_LIMIT
    }
  })],
  plugins: [{
    requestDidStart (initialRequestContext) {
      return {
        executionDidStart () {
          return {
            willResolveField ({ source, args, context, info }) {
              const start = process.hrtime.bigint()
              return (error, result) => {
                const end = process.hrtime.bigint()
                const ms = (end - start) / 1000000n
                if (process.env.GRAPHQL_SLOW_LOGS_MS && ms > process.env.GRAPHQL_SLOW_LOGS_MS) {
                  console.log(`Field ${info.parentType.name}.${info.fieldName} took ${ms}ms`)
                }
                if (error) {
                  console.log(`Field ${info.parentType.name}.${info.fieldName} failed with ${error}`)
                }
              }
            },
            async executionDidEnd (err) {
              if (err) {
                console.error('hey bud', err)
              }
            }
          }
        }
      }
    }
  },
  process.env.NODE_ENV === 'production'
    ? ApolloServerPluginLandingPageProductionDefault(
      { embed: { endpointIsEditable: false, persistExplorerState: true, displayOptions: { theme: 'dark' } }, footer: false })
    : ApolloServerPluginLandingPageLocalDefault(
      { embed: { endpointIsEditable: false, persistExplorerState: true, displayOptions: { theme: 'dark' } }, footer: false })]
})

export default startServerAndCreateNextHandler(apolloServer, {
  context: async (req, res) => {
    const apiKey = req.headers['x-api-key']
    let session
    if (apiKey) {
      const [user] = await models.$queryRaw`
      SELECT id, name, "apiKeyEnabled"
      FROM users
      WHERE "apiKeyHash" = encode(digest(${apiKey}, 'sha256'), 'hex')
      LIMIT 1`
      if (user?.apiKeyEnabled) {
        const { apiKeyEnabled, ...sessionFields } = user
        session = { user: { ...sessionFields, apiKey: true } }
      }
    } else {
      req = await multiAuthMiddleware(req, res)
      session = await getServerSession(req, res, getAuthOptions(req))
    }
    return {
      models,
      headers: req.headers,
      lnd,
      me: session
        ? session.user
        : null,
      search
    }
  }
})
