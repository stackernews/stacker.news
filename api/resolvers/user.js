import { AuthenticationError, UserInputError } from 'apollo-server-errors'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { createMentions, getItem, SELECT, updateItem, filterClause } from './item'
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

export function earnWithin (within) {
  let interval = ' AND "Earn".created_at >= $1 - INTERVAL '
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

async function authMethods (user, args, { models, me }) {
  const accounts = await models.account.findMany({
    where: {
      userId: me.id
    }
  })

  const oauth = accounts.map(a => a.providerId)

  return {
    lightning: !!user.pubkey,
    email: user.emailVerified && user.email,
    twitter: oauth.indexOf('twitter') >= 0,
    github: oauth.indexOf('github') >= 0
  }
}

export default {
  Query: {
    me: async (parent, args, { models, me }) => {
      if (!me) {
        return null
      }

      return await models.user.update({ where: { id: me.id }, data: { lastSeenAt: new Date() } })
    },
    settings: async (parent, args, { models, me }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

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

      const user = await models.user.findUnique({ where: { id: me.id } })

      return user.name?.toUpperCase() === name?.toUpperCase() || !(await models.user.findUnique({ where: { name } }))
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
          SELECT name, created_at, sum(sats) as amount
          FROM
          ((SELECT users.name, users.created_at, "ItemAct".sats as sats
            FROM "ItemAct"
            JOIN "Item" on "ItemAct"."itemId" = "Item".id
            JOIN users on "Item"."userId" = users.id
            WHERE act <> 'BOOST' AND "ItemAct"."userId" <> users.id AND "ItemAct".created_at <= $1
            ${topClause(within)})
          UNION ALL
          (SELECT users.name, users.created_at, "Earn".msats/1000 as sats
            FROM "Earn"
            JOIN users on users.id = "Earn"."userId"
            WHERE "Earn".msats > 0 ${earnWithin(within)})) u
          GROUP BY name, created_at
          ORDER BY amount DESC NULLS LAST, created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      }

      return {
        cursor: users.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        users
      }
    },
    searchUsers: async (parent, { q, limit, similarity }, { models }) => {
      return await models.$queryRaw`
        SELECT * FROM users where id > 615 AND SIMILARITY(name, ${q}) > ${Number(similarity) || 0.1} ORDER BY SIMILARITY(name, ${q}) DESC LIMIT ${Number(limit) || 5}`
    }
  },

  Mutation: {
    setName: async (parent, { name }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      if (!/^[\w_]+$/.test(name)) {
        throw new UserInputError('only letters, numbers, and _')
      }

      if (name.length > 32) {
        throw new UserInputError('too long')
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
    setSettings: async (parent, data, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      return await models.user.update({ where: { id: me.id }, data })
    },
    setWalkthrough: async (parent, { upvotePopover, tipPopover }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await models.user.update({ where: { id: me.id }, data: { upvotePopover, tipPopover } })

      return true
    },
    setPhoto: async (parent, { photoId }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await models.user.update({
        where: { id: me.id },
        data: { photoId: Number(photoId) }
      })

      return Number(photoId)
    },
    upsertBio: async (parent, { bio }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      const user = await models.user.findUnique({ where: { id: me.id } })

      if (user.bioId) {
        await updateItem(parent, { id: user.bioId, data: { text: bio, title: `@${user.name}'s bio` } }, { me, models })
      } else {
        const [item] = await serialize(models,
          models.$queryRaw(`${SELECT} FROM create_bio($1, $2, $3) AS "Item"`,
            `@${user.name}'s bio`, bio, Number(me.id)))
        await createMentions(item, models)
      }

      return await models.user.findUnique({ where: { id: me.id } })
    },
    unlinkAuth: async (parent, { authType }, { models, me }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      if (authType === 'twitter' || authType === 'github') {
        const user = await models.user.findUnique({ where: { id: me.id } })
        const account = await models.account.findFirst({ where: { userId: me.id, providerId: authType } })
        if (!account) {
          throw new UserInputError('no such account')
        }
        await models.account.delete({ where: { id: account.id } })
        return await authMethods(user, undefined, { models, me })
      }

      if (authType === 'lightning') {
        const user = await models.user.update({ where: { id: me.id }, data: { pubkey: null } })
        return await authMethods(user, undefined, { models, me })
      }

      if (authType === 'email') {
        const user = await models.user.update({ where: { id: me.id }, data: { email: null, emailVerified: null } })
        return await authMethods(user, undefined, { models, me })
      }

      throw new UserInputError('no such account')
    },
    linkUnverifiedEmail: async (parent, { email }, { models, me }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      try {
        await models.user.update({
          where: { id: me.id },
          data: { email: email.toLowerCase() }
        })
      } catch (error) {
        if (error.code === 'P2002') {
          throw new UserInputError('email taken')
        }
        throw error
      }

      return true
    }
  },

  User: {
    authMethods,
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

      return Math.floor((user.stackedMsats || 0) / 1000)
    },
    spent: async (user, args, { models }) => {
      const { sum: { sats } } = await models.itemAct.aggregate({
        sum: {
          sats: true
        },
        where: {
          userId: user.id
        }
      })

      return sats || 0
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
      const invites = await models.user.findUnique({
        where: { id: user.id }
      }).invites({ take: 1 })

      return invites.length > 0
    },
    hasNewNotes: async (user, args, { me, models }) => {
      const lastChecked = user.checkedNotesAt || new Date(0)

      // check if any votes have been cast for them since checkedNotesAt
      if (user.noteItemSats) {
        const votes = await models.$queryRaw(`
        SELECT "ItemAct".id, "ItemAct".created_at
          FROM "Item"
          JOIN "ItemAct" on "ItemAct"."itemId" = "Item".id
          WHERE "ItemAct"."userId" <> $1
          AND "ItemAct".created_at > $2
          AND "Item"."userId" = $1
          AND "ItemAct".act IN ('VOTE', 'TIP')
          LIMIT 1`, me.id, lastChecked)
        if (votes.length > 0) {
          return true
        }
      }

      // check if they have any replies since checkedNotesAt
      const newReplies = await models.$queryRaw(`
        SELECT "Item".id, "Item".created_at
          FROM "Item"
          JOIN "Item" p ON ${user.noteAllDescendants ? '"Item".path <@ p.path' : '"Item"."parentId" = p.id'}
          WHERE p."userId" = $1
          AND "Item".created_at > $2  AND "Item"."userId" <> $1
          ${await filterClause(me, models)}
          LIMIT 1`, me.id, lastChecked)
      if (newReplies.length > 0) {
        return true
      }

      // check if they have any mentions since checkedNotesAt
      if (user.noteMentions) {
        const newMentions = await models.$queryRaw(`
        SELECT "Item".id, "Item".created_at
          FROM "Mention"
          JOIN "Item" ON "Mention"."itemId" = "Item".id
          WHERE "Mention"."userId" = $1
          AND "Mention".created_at > $2
          AND "Item"."userId" <> $1
          LIMIT 1`, me.id, lastChecked)
        if (newMentions.length > 0) {
          return true
        }
      }

      const job = await models.item.findFirst({
        where: {
          maxBid: {
            not: null
          },
          userId: me.id,
          statusUpdatedAt: {
            gt: lastChecked
          }
        }
      })
      if (job) {
        return true
      }

      if (user.noteEarning) {
        const earn = await models.earn.findFirst({
          where: {
            userId: me.id,
            createdAt: {
              gt: lastChecked
            },
            msats: {
              gte: 1000
            }
          }
        })
        if (earn) {
          return true
        }
      }

      if (user.noteDeposits) {
        const invoice = await models.invoice.findFirst({
          where: {
            userId: me.id,
            confirmedAt: {
              gt: lastChecked
            }
          }
        })
        if (invoice) {
          return true
        }
      }

      // check if new invites have been redeemed
      if (user.noteInvites) {
        const newInvitees = await models.$queryRaw(`
        SELECT "Invite".id
          FROM users JOIN "Invite" on users."inviteId" = "Invite".id
          WHERE "Invite"."userId" = $1
          AND users.created_at > $2
          LIMIT 1`, me.id, lastChecked)
        if (newInvitees.length > 0) {
          return true
        }
      }

      return false
    }
  }
}
