import { AuthenticationError, UserInputError } from 'apollo-server-errors'

export default {
  Query: {
    me: async (parent, args, { models, me }) =>
      me ? await models.user.findUnique({ where: { id: me.id } }) : null,
    user: async (parent, { name }, { models }) => {
      return await models.user.findUnique({ where: { name } })
    },
    users: async (parent, args, { models }) =>
      await models.user.findMany(),
    nameAvailable: async (parent, { name }, { models, me }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      return me.name?.toUpperCase() === name?.toUpperCase() || !(await models.user.findUnique({ where: { name } }))
    }
  },

  Mutation: {
    setName: async (parent, { name }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      try {
        await models.user.update({ where: { id: me.id }, data: { name } })
      } catch (error) {
        if (error.code === 'P2002') {
          throw new UserInputError('name taken')
        }
        throw error
      }
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
        FROM "Vote"
        JOIN "Item" on "Vote"."itemId" = "Item".id
        WHERE "Vote"."userId" <> ${user.id} AND boost = false
        AND "Item"."userId" = ${user.id}`
      return sum || 0
    },
    sats: async (user, args, { models }) => {
      return Math.floor(user.msats / 1000)
    },
    hasNewNotes: async (user, args, { models }) => {
      // check if any votes have been cast for them since checkedNotesAt
      const votes = await models.$queryRaw(`
        SELECT "Vote".id, "Vote".created_at
        FROM "Vote"
        JOIN "Item" on "Vote"."itemId" = "Item".id
        WHERE "Vote"."userId" <> $1
        AND ("Vote".created_at > $2 OR $2 IS NULL)
        AND "Vote".boost = false
        AND "Item"."userId" = $1
        LIMIT 1`, user.id, user.checkedNotesAt)
      if (votes.length > 0) {
        return true
      }

      // check if they have any replies since checkedNotesAt
      const newReplies = await models.$queryRaw(`
        SELECT "Item".id, "Item".created_at
        From "Item"
        JOIN "Item" p ON "Item"."parentId" = p.id
        WHERE p."userId" = $1
        AND ("Item".created_at > $2 OR $2 IS NULL)  AND "Item"."userId" <> $1
        LIMIT 1`, user.id, user.checkedNotesAt)
      if (newReplies.length > 0) {
        return true
      }

      // check if they have any mentions since checkedNotesAt
      const newMentions = await models.$queryRaw(`
        SELECT "Item".id, "Item".created_at
        From "Mention"
        JOIN "Item" ON "Mention"."itemId" = "Item".id
        WHERE "Mention"."userId" = $1
        AND ("Mention".created_at > $2 OR $2 IS NULL)
        AND "Item"."userId" <> $1
        LIMIT 1`, user.id, user.checkedNotesAt)
      return newMentions.length > 0
    }
  }
}
