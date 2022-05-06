import { ApolloServer } from 'apollo-server-micro'
import resolvers from '../../api/resolvers'
import models from '../../api/models'
import lnd from '../../api/lnd'
import typeDefs from '../../api/typeDefs'
import { getSession } from 'next-auth/client'
import search from '../../api/search'

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [{
    requestDidStart (initialRequestContext) {
      return {
        executionDidStart (executionRequestContext) {
          return {
            willResolveField ({ source, args, context, info }) {
              const start = process.hrtime.bigint()
              return (error, result) => {
                const end = process.hrtime.bigint()
                const ms = (end - start) / 1000000n
                if (ms > 20 && info.parentType.name !== 'User') {
                  console.log(`Field ${info.parentType.name}.${info.fieldName} took ${ms}ms`)
                }
                if (error) {
                  console.log(`It failed with ${error}`)
                }
              }
            }
          }
        }
      }
    }
  }],
  context: async ({ req }) => {
    const session = await getSession({ req })
    return {
      models,
      lnd,
      me: session
        ? session.user
        : null,
      search
    }
  }
})

export const config = {
  api: {
    bodyParser: false
  }
}

export default apolloServer.createHandler({ path: '/api/graphql' })
