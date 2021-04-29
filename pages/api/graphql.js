import { ApolloServer } from 'apollo-server-micro'
import resolvers from '../../api/resolvers'
import models from '../../api/models'
import typeDefs from '../../api/typeDefs'
import { getSession } from 'next-auth/client'

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  tracing: true,
  context: async ({ req }) => {
    const session = await getSession({ req })
    return {
      models,
      me: session ? session.user : null
    }
  }
})

export const config = {
  api: {
    bodyParser: false
  }
}

export default apolloServer.createHandler({ path: '/api/graphql' })
