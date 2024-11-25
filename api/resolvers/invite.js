import { inviteSchema, validateSchema } from '@/lib/validate'
import { msatsToSats } from '@/lib/format'
import assertApiKeyNotPermitted from './apiKey'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { Prisma } from '@prisma/client'

export default {
  Query: {
    invites: async (parent, args, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
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
    createInvite: async (parent, { id, gift, limit, description }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      assertApiKeyNotPermitted({ me })

      await validateSchema(inviteSchema, { id, gift, limit, description })
      try {
        return await models.invite.create({
          data: {
            id,
            gift,
            limit,
            userId: me.id,
            description
          }
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002' && error.meta.target.includes('id')) {
            throw new GqlInputError('an invite with this code already exists')
          }
        }
        throw error
      }
    },
    revokeInvite: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
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
      return msatsToSats(user.msats) < invite.gift
    },
    description: (invite, args, { me }) => {
      return invite.userId === me?.id ? invite.description : undefined
    }
  }
}
