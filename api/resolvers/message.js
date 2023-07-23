import { GraphQLError } from 'graphql'

export default {
  Query: {
    messages: async (parent, args, { models }) =>
      await models.message.findMany(),
    message: async (parent, { id }, { models }) =>
      await models.message.findUnique({ where: { id } })
  },

  Mutation: {
    createMessage: async (parent, { text }, { me, models }) => {
      if (!text) {
        throw new GraphQLError('Must have text', { extensions: { code: 'BAD_INPUT' } })
      }

      return await models.message.create({
        data: { text, userId: me.id }
      })
    },
    deleteMessage: async (parent, { id }, { models }) =>
      await models.message.delete({ where: { id } })
  },

  Message: {
    user: async (message, args, { models }) =>
      await models.user.findUnique({ where: { id: message.userId } })
  }
}
