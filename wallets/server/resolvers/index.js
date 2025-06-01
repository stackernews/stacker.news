import { resolvers as walletResolvers } from './wallet'
import { resolvers as protocolResolvers } from './protocol'

export default {
  Query: {
    ...walletResolvers.Query,
    ...protocolResolvers.Query
  },
  Mutation: {
    ...walletResolvers.Mutation,
    ...protocolResolvers.Mutation
  }
}
