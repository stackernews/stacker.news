export default {
  Query: {
    me: async (parent, args, { models, me }) =>
      me ? await models.user.findUnique({ where: { id: me.id } }) : null,
    user: async (parent, { name }, { models }) => {
      return await models.user.findUnique({ where: { name } })
    },
    users: async (parent, args, { models }) =>
      await models.user.findMany()
  },

  User: {
    nitems: async (user, args, { models }) => {
      return await models.item.count({ where: { userId: user.id, parentId: null } })
    },
    ncomments: async (user, args, { models }) => {
      return await models.item.count({ where: { userId: user.id, parentId: { not: null } } })
    },
    stacked: async (user, args, { models }) => {
      const [{ sum }] = await models.$queryRaw`
        SELECT sum("Vote".sats)
        FROM "Item"
        LEFT JOIN "Vote" on "Vote"."itemId" = "Item".id
        WHERE "Item"."userId" = ${user.id}`
      return sum
    },
    sats: () => 0
  }
}
