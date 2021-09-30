import { ApolloServer } from 'apollo-server-micro'
import resolvers from '../../api/resolvers'
import models from '../../api/models'
import lnd from '../../api/lnd'
import typeDefs from '../../api/typeDefs'
import { getSession } from 'next-auth/client'

global.apolloServer ||= new ApolloServer({
  typeDefs,
  resolvers,
  tracing: true,
  context: async ({ req }) => {
    const session = await getSession({ req })
    return {
      models,
      lnd,
      me: session ? session.user : null
    }
  }
})

export const config = {
  api: {
    bodyParser: false
  }
}

export default global.apolloServer.createHandler({ path: '/api/graphql' })
