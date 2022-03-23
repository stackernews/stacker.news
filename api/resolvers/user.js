import { AuthenticationError, UserInputError } from 'apollo-server-errors'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { createMentions, getItem, SELECT } from './item'
import serialize from './serial'

export function topClause (within) {
  let interval = ' AND "ItemAct".created_at >= $1 - INTERVAL '
  switch (within) {
    case 'day':
      interval += "'1 day'"
      break
    case 'week':
      interval += "'7 days'"
      break
    case 'month':
      interval += "'1 month'"
      break
    case 'year':
      interval += "'1 year'"
      break
    default:
      interval = ''
      break
  }
  return interval
}

export default {
  Query: {
    me: async (parent, args, { models, me }) => {
      if (!me) {
        return null
      }

      await models.user.update({ where: { id: me.id }, data: { lastSeenAt: new Date() } })

      return await models.user.findUnique({ where: { id: me.id } })
    },
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
    },
    topUsers: async (parent, { cursor, within, userType }, { models, me }) => {
      const decodedCursor = decodeCursor(cursor)
      let users
      if (userType === 'spent') {
        users = await models.$queryRaw(`
          SELECT users.name, users.created_at, sum("ItemAct".sats) as amount
          FROM "ItemAct"
          JOIN users on "ItemAct"."userId" = users.id
          WHERE "ItemAct".created_at <= $1
          ${topClause(within)}
          GROUP BY users.id, users.name
          ORDER BY amount DESC NULLS LAST, users.created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      } else {
        users = await models.$queryRaw(`
          SELECT users.name, users.created_at, sum("ItemAct".sats) as amount
          FROM "ItemAct"
          JOIN "Item" on "ItemAct"."itemId" = "Item".id
          JOIN users on "Item"."userId" = users.id
          WHERE act <> 'BOOST' AND "ItemAct"."userId" <> users.id AND "ItemAct".created_at <= $1
          ${topClause(within)}
          GROUP BY users.id, users.name
          ORDER BY amount DESC NULLS LAST, users.created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      }

      return {
        cursor: users.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        users
      }
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
      if (user.stacked) {
        return user.stacked
      }
      const [{ sum }] = await models.$queryRaw`
        SELECT sum("ItemAct".sats)
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        WHERE "ItemAct"."userId" <> ${user.id} AND "ItemAct".act <> 'BOOST'
        AND "Item"."userId" = ${user.id}`

      const { sum: { msats } } = await models.earn.aggregate({
        sum: {
          msats: true
        },
        where: {
          userId: Number(user.id)
        }
      })

      return (sum || 0) + Math.floor((msats || 0) / 1000)
    },
    sats: async (user, args, { models, me }) => {
      if (me?.id !== user.id) {
        return 0
      }
      return Math.floor(user.msats / 1000.0)
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
          FROM "Item"
          JOIN "Item" p ON "Item".path <@ p.path
          WHERE p."userId" = $1
          AND ("Item".created_at > $2 OR $2 IS NULL)  AND "Item"."userId" <> $1
          LIMIT 1`, user.id, user.checkedNotesAt)
      if (newReplies.length > 0) {
        return true
      }

      // check if they have any mentions since checkedNotesAt
      const newMentions = await models.$queryRaw(`
        SELECT "Item".id, "Item".created_at
          FROM "Mention"
          JOIN "Item" ON "Mention"."itemId" = "Item".id
          WHERE "Mention"."userId" = $1
          AND ("Mention".created_at > $2 OR $2 IS NULL)
          AND "Item"."userId" <> $1
          LIMIT 1`, user.id, user.checkedNotesAt)
      if (newMentions.length > 0) {
        return true
      }

      const job = await models.item.findFirst({
        where: {
          status: {
            not: 'STOPPED'
          },
          maxBid: {
            not: null
          },
          userId: user.id,
          statusUpdatedAt: {
            gt: user.checkedNotesAt || new Date(0)
          }
        }
      })
      if (job) {
        return true
      }

      const earn = await models.earn.findFirst({
        where: {
          userId: user.id,
          createdAt: {
            gt: user.checkedNotesAt || new Date(0)
          },
          msats: {
            gte: 1000
          }
        }
      })
      if (earn) {
        return true
      }

      const invoice = await models.invoice.findFirst({
        where: {
          userId: user.id,
          confirmedAt: {
            gt: user.checkedNotesAt || new Date(0)
          }
        }
      })
      if (invoice) {
        return true
      }

      // check if new invites have been redeemed
      const newInvitees = await models.$queryRaw(`
        SELECT "Invite".id
          FROM users JOIN "Invite" on users."inviteId" = "Invite".id
          WHERE "Invite"."userId" = $1
          AND (users.created_at > $2 or $2 IS NULL)
          LIMIT 1`, user.id, user.checkedNotesAt)
      return newInvitees.length > 0
    }
  }
}
