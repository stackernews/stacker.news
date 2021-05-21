import { AuthenticationError } from 'apollo-server-errors'

export default {
  Query: {
    me: async (parent, args, { models, me }) =>
      me ? await models.user.findUnique({ where: { name: me.name } }) : null,
    user: async (parent, { name }, { models }) => {
      return await models.user.findUnique({ where: { name } })
    },
    users: async (parent, args, { models }) =>
      await models.user.findMany(),
    nameAvailable: async (parent, { name }, { models, me }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      return me.name === name || !(await models.user.findUnique({ where: { name } }))
    }
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
        LEFT JOIN "Vote" on "Vote"."itemId" = "Item".id AND "Item"."userId" <> ${user.id}
        WHERE "Item"."userId" = ${user.id}`
      return sum || 0
    },
    sats: async (user, args, { models }) => {
      return Math.floor(user.msats / 1000)
    }
  }
}
