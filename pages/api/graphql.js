import { ApolloServer } from '@apollo/server'
import { startServerAndCreateNextHandler } from '@as-integrations/next'
import resolvers from '../../api/resolvers'
import models from '../../api/models'
import lnd from '../../api/lnd'
import typeDefs from '../../api/typeDefs'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from './auth/[...nextauth]'
import search from '../../api/search'
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault
} from '@apollo/server/plugin/landingPage/default'

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
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
                if (ms > 50) {
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
    const session = await getServerSession(req, res, getAuthOptions(req))
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
