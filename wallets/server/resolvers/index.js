import { resolvers as walletResolvers } from './wallet'
import { resolvers as protocolResolvers } from './protocol'

export default {
  ...walletResolvers,
  ...protocolResolvers,
  Query: {
    ...walletResolvers.Query,
    ...protocolResolvers.Query
  },
  Mutation: {
    ...walletResolvers.Mutation,
    ...protocolResolvers.Mutation
  }

}
