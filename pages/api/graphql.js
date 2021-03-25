import { ApolloServer } from 'apollo-server-micro'
import resolvers from '../../api/resolvers'
import models from '../../api/models'
import typeDefs from '../../api/typeDefs'

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  context: async () => ({
    models,
    me: await models.user.findUnique({ where: { name: 'k00b' } })
  })
})

export const config = {
  api: {
    bodyParser: false
  }
}

export default apolloServer.createHandler({ path: '/api/graphql' })
