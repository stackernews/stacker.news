import { AuthenticationError, UserInputError } from 'apollo-server-micro'

export default {
  Query: {
    invites: async (parent, args, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      return await models.invite.findMany({
        where: {
          userId: me.id
        }
      })
    }
  },

  Mutation: {
    createInvite: async (parent, { gift, limit }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      if (!gift || (gift && gift < 0)) {
        throw new UserInputError('gift must be >= 0', { argumentName: 'gift' })
      }

      return await models.invite.create({
        data: { gift, limit, userId: me.id }
      })
    }
  },

  Invite: {
    invitees: async (invite, args, { models }) => []
  }
}
