import { ApolloServer } from 'apollo-server-micro'
import resolvers from '../../api/resolvers'
import models from '../../api/models'
import typeDefs from '../../api/typeDefs'
import { getSession } from 'next-auth/client'

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const session = await getSession({ req })
    return {
      models,
      me: session ? session.user : await models.user.findUnique({ where: { name: 'k00b' } })
    }
  }
})

export const config = {
  api: {
    bodyParser: false
  }
}

export default apolloServer.createHandler({ path: '/api/graphql' })
