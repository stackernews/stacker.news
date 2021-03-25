export default {
  Query: {
    me: async (parent, args, { models, me }) =>
      me ? await models.user.findUnique({ where: { id: me.id } }) : null,
    user: async (parent, { id }, { models }) =>
      await models.user.findUnique({ where: { id } }),
    users: async (parent, args, { models }) =>
      await models.user.findMany()
  },

  User: {
    messages: async (user, args, { models }) =>
      await models.message.findMany({
        where: {
          userId: user.id
        }
      })
  }
}
