import { AuthenticationError, UserInputError } from 'apollo-server-errors'
import { createMentions, getItem, SELECT } from './item'
import serialize from './serial'

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
    },
    setSettings: async (parent, { tipDefault }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await models.user.update({ where: { id: me.id }, data: { tipDefault } })

      return true
    },
    setWalkthrough: async (parent, { upvotePopover, tipPopover }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await models.user.update({ where: { id: me.id }, data: { upvotePopover, tipPopover } })

      return true
    },
    setTheme: async (parent, { theme }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await models.user.update({ where: { id: me.id }, data: { theme } })

      return true
    },
    upsertBio: async (parent, { bio }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      const user = await models.user.findUnique({ where: { id: me.id } })

      let item
      if (user.bioId) {
        item = await models.item.update({
          where: { id: Number(user.bioId) },
          data: {
            text: bio
          }
        })
      } else {
        ([item] = await serialize(models,
          models.$queryRaw(`${SELECT} FROM create_bio($1, $2, $3) AS "Item"`,
            `@${me.name}'s bio`, bio, Number(me.id))))
      }

      await createMentions(item, models)

      return await models.user.findUnique({ where: { id: me.id } })
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
        SELECT sum("ItemAct".sats)
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        WHERE "ItemAct"."userId" <> ${user.id} AND "ItemAct".act <> 'BOOST'
        AND "Item"."userId" = ${user.id}`
      return sum || 0
    },
    sats: async (user, args, { models }) => {
      return Math.floor(user.msats / 1000)
    },
    bio: async (user, args, { models }) => {
      return getItem(user, { id: user.bioId }, { models })
    },
    hasInvites: async (user, args, { models }) => {
      const anInvite = await models.invite.findFirst({
        where: { userId: user.id }
      })
      return !!anInvite
    },
    hasNewNotes: async (user, args, { models }) => {
      // check if any votes have been cast for them since checkedNotesAt
      const votes = await models.$queryRaw(`
        SELECT "ItemAct".id, "ItemAct".created_at
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        WHERE "ItemAct"."userId" <> $1
        AND ("ItemAct".created_at > $2 OR $2 IS NULL)
        AND "ItemAct".act <> 'BOOST'
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
