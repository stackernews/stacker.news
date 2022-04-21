import { ApolloServer } from 'apollo-server-micro'
import resolvers from '../../api/resolvers'
import models from '../../api/models'
import lnd from '../../api/lnd'
import typeDefs from '../../api/typeDefs'
import { getSession } from 'next-auth/client'
import search from '../../api/search'

global.apolloServer ||= new ApolloServer({
  typeDefs,
  resolvers,
  tracing: true,
  context: async ({ req }) => {
    const session = await getSession({ req })
    return {
      models,
      lnd,
      me: session
        ? await models.user.findUnique({ where: { id: session.user?.id } })
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

export default global.apolloServer.createHandler({ path: '/api/graphql' })
