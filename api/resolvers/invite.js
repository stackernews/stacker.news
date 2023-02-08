import { AuthenticationError } from 'apollo-server-micro'
import { inviteSchema, ssValidate } from '../../lib/validate'

export default {
  Query: {
    invites: async (parent, args, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      return await models.invite.findMany({
        where: {
          userId: me.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    },
    invite: async (parent, { id }, { me, models }) => {
      return await models.invite.findUnique({
        where: {
          id
        }
      })
    }
  },

  Mutation: {
    createInvite: async (parent, { gift, limit }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await ssValidate(inviteSchema, { gift, limit })

      return await models.invite.create({
        data: { gift, limit, userId: me.id }
      })
    },
    revokeInvite: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      return await models.invite.update({
        where: { id },
        data: { revoked: true }
      })
    }
  },

  Invite: {
    invitees: async (invite, args, { me, models }) => {
      return await models.user.findMany({ where: { inviteId: invite.id } })
    },
    user: async (invite, args, { me, models }) => {
      return await models.user.findUnique({ where: { id: invite.userId } })
    },
    poor: async (invite, args, { me, models }) => {
      const user = await models.user.findUnique({ where: { id: invite.userId } })
      return user.msats < invite.gift * 1000
    }
  }
}
