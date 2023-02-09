import { AuthenticationError, UserInputError } from 'apollo-server-errors'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { msatsToSats } from '../../lib/format'
import { bioSchema, emailSchema, settingsSchema, ssValidate, userSchema } from '../../lib/validate'
import { createMentions, getItem, SELECT, updateItem, filterClause } from './item'
import serialize from './serial'

export function within (table, within) {
  let interval = ' AND "' + table + '".created_at >= $1 - INTERVAL '
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

export function withinDate (within) {
  switch (within) {
    case 'day':
      return new Date(new Date().setDate(new Date().getDate() - 1))
    case 'week':
      return new Date(new Date().setDate(new Date().getDate() - 7))
    case 'month':
      return new Date(new Date().setDate(new Date().getDate() - 30))
    case 'year':
      return new Date(new Date().setDate(new Date().getDate() - 365))
    default:
      return new Date(0)
  }
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
    github: oauth.indexOf('github') >= 0,
    slashtags: !!user.slashtagId
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
    topCowboys: async (parent, { cursor }, { models, me }) => {
      const decodedCursor = decodeCursor(cursor)
      const users = await models.$queryRaw(`
        SELECT users.*
          FROM users
          WHERE NOT "hideFromTopUsers" AND streak IS NOT NULL
          ORDER BY streak DESC, created_at ASC
          OFFSET $1
          LIMIT ${LIMIT}`, decodedCursor.offset)
      return {
        cursor: users.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        users
      }
    },
    topUsers: async (parent, { cursor, when, sort }, { models, me }) => {
      const decodedCursor = decodeCursor(cursor)
      let users
      if (sort === 'spent') {
        users = await models.$queryRaw(`
          SELECT users.*, sum(sats_spent) as spent
          FROM
          ((SELECT "userId", floor(sum("ItemAct".msats)/1000) as sats_spent
            FROM "ItemAct"
            WHERE "ItemAct".created_at <= $1
            ${within('ItemAct', when)}
            GROUP BY "userId")
            UNION ALL
          (SELECT "userId", sats as sats_spent
            FROM "Donation"
            WHERE created_at <= $1
            ${within('Donation', when)})) spending
          JOIN users on spending."userId" = users.id
          AND NOT users."hideFromTopUsers"
          GROUP BY users.id, users.name
          ORDER BY spent DESC NULLS LAST, users.created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      } else if (sort === 'posts') {
        users = await models.$queryRaw(`
        SELECT users.*, count(*) as nitems
          FROM users
          JOIN "Item" on "Item"."userId" = users.id
          WHERE "Item".created_at <= $1 AND "Item"."parentId" IS NULL
          AND NOT users."hideFromTopUsers"
          ${within('Item', when)}
          GROUP BY users.id
          ORDER BY nitems DESC NULLS LAST, users.created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      } else if (sort === 'comments') {
        users = await models.$queryRaw(`
        SELECT users.*, count(*) as ncomments
          FROM users
          JOIN "Item" on "Item"."userId" = users.id
          WHERE "Item".created_at <= $1 AND "Item"."parentId" IS NOT NULL
          AND NOT users."hideFromTopUsers"
          ${within('Item', when)}
          GROUP BY users.id
          ORDER BY ncomments DESC NULLS LAST, users.created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      } else if (sort === 'referrals') {
        users = await models.$queryRaw(`
          SELECT users.*, count(*) as referrals
          FROM users
          JOIN "users" referree on users.id = referree."referrerId"
          WHERE referree.created_at <= $1
          AND NOT users."hideFromTopUsers"
          ${within('referree', when)}
          GROUP BY users.id
          ORDER BY referrals DESC NULLS LAST, users.created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      } else {
        users = await models.$queryRaw(`
          SELECT u.id, u.name, u.streak, u."photoId", floor(sum(amount)/1000) as stacked
          FROM
          ((SELECT users.*, "ItemAct".msats as amount
            FROM "ItemAct"
            JOIN "Item" on "ItemAct"."itemId" = "Item".id
            JOIN users on "Item"."userId" = users.id
            WHERE act <> 'BOOST' AND "ItemAct"."userId" <> users.id AND "ItemAct".created_at <= $1
            AND NOT users."hideFromTopUsers"
            ${within('ItemAct', when)})
          UNION ALL
          (SELECT users.*, "Earn".msats as amount
            FROM "Earn"
            JOIN users on users.id = "Earn"."userId"
            WHERE "Earn".msats > 0 ${within('Earn', when)}
            AND NOT users."hideFromTopUsers")
          UNION ALL
          (SELECT users.*, "ReferralAct".msats as amount
              FROM "ReferralAct"
              JOIN users on users.id = "ReferralAct"."referrerId"
              WHERE "ReferralAct".msats > 0 ${within('ReferralAct', when)}
              AND NOT users."hideFromTopUsers")) u
          GROUP BY u.id, u.name, u.created_at, u."photoId", u.streak
          ORDER BY stacked DESC NULLS LAST, created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      }

      return {
        cursor: users.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        users
      }
    },
    hasNewNotes: async (parent, args, { me, models }) => {
      if (!me) {
        return false
      }
      const user = await models.user.findUnique({ where: { id: me.id } })
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
          AND "ItemAct".act = 'TIP'
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
      if (job && job.statusUpdatedAt > job.createdAt) {
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

        const referral = await models.user.findFirst({
          where: {
            referrerId: me.id,
            createdAt: {
              gt: lastChecked
            }
          }
        })
        if (referral) {
          return true
        }
      }

      if (user.noteCowboyHat) {
        const streak = await models.streak.findFirst({
          where: {
            userId: me.id,
            updatedAt: {
              gt: lastChecked
            }
          }
        })

        if (streak) {
          return true
        }
      }

      return false
    },
    searchUsers: async (parent, { q, limit, similarity }, { models }) => {
      return await models.$queryRaw`
        SELECT * FROM users where id > 615 AND SIMILARITY(name, ${q}) > ${Number(similarity) || 0.1} ORDER BY SIMILARITY(name, ${q}) DESC LIMIT ${Number(limit) || 5}`
    }
  },

  Mutation: {
    setName: async (parent, data, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await ssValidate(userSchema, data, models)

      try {
        await models.user.update({ where: { id: me.id }, data })
      } catch (error) {
        if (error.code === 'P2002') {
          throw new UserInputError('name taken')
        }
        throw error
      }
    },
    setSettings: async (parent, { nostrRelays, ...data }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await ssValidate(settingsSchema, { nostrRelays, ...data })

      if (nostrRelays?.length) {
        const connectOrCreate = []
        for (const nr of nostrRelays) {
          await models.nostrRelay.upsert({
            where: { addr: nr },
            update: { addr: nr },
            create: { addr: nr }
          })
          connectOrCreate.push({
            where: { userId_nostrRelayAddr: { userId: me.id, nostrRelayAddr: nr } },
            create: { nostrRelayAddr: nr }
          })
        }

        return await models.user.update({ where: { id: me.id }, data: { ...data, nostrRelays: { deleteMany: {}, connectOrCreate } } })
      } else {
        return await models.user.update({ where: { id: me.id }, data: { ...data, nostrRelays: { deleteMany: {} } } })
      }
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

      await ssValidate(bioSchema, { bio })

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

      let user
      if (authType === 'twitter' || authType === 'github') {
        user = await models.user.findUnique({ where: { id: me.id } })
        const account = await models.account.findFirst({ where: { userId: me.id, providerId: authType } })
        if (!account) {
          throw new UserInputError('no such account')
        }
        await models.account.delete({ where: { id: account.id } })
      } else if (authType === 'lightning') {
        user = await models.user.update({ where: { id: me.id }, data: { pubkey: null } })
      } else if (authType === 'slashtags') {
        user = await models.user.update({ where: { id: me.id }, data: { slashtagId: null } })
      } else if (authType === 'email') {
        user = await models.user.update({ where: { id: me.id }, data: { email: null, emailVerified: null } })
      } else {
        throw new UserInputError('no such account')
      }

      return await authMethods(user, undefined, { models, me })
    },
    linkUnverifiedEmail: async (parent, { email }, { models, me }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await ssValidate(emailSchema, { email })

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
    nitems: async (user, { when }, { models }) => {
      if (user.nitems) {
        return user.nitems
      }
      return await models.item.count({
        where: {
          userId: user.id,
          parentId: null,
          createdAt: {
            gte: withinDate(when)
          }
        }
      })
    },
    ncomments: async (user, { when }, { models }) => {
      if (user.ncomments) {
        return user.ncomments
      }

      return await models.item.count({
        where: {
          userId: user.id,
          parentId: { not: null },
          createdAt: {
            gte: withinDate(when)
          }
        }
      })
    },
    stacked: async (user, { when }, { models }) => {
      if (user.stacked) {
        return user.stacked
      }

      if (!when) {
        // forever
        return (user.stackedMsats && msatsToSats(user.stackedMsats)) || 0
      } else {
        const [{ stacked }] = await models.$queryRaw(`
          SELECT sum(amount) as stacked
          FROM
          ((SELECT coalesce(sum("ItemAct".msats),0) as amount
            FROM "ItemAct"
            JOIN "Item" on "ItemAct"."itemId" = "Item".id
            WHERE act <> 'BOOST' AND "ItemAct"."userId" <> $2 AND "Item"."userId" = $2
            AND "ItemAct".created_at >= $1)
          UNION ALL
            (SELECT coalesce(sum("ReferralAct".msats),0) as amount
              FROM "ReferralAct"
              WHERE "ReferralAct".msats > 0 AND "ReferralAct"."referrerId" = $2
              AND "ReferralAct".created_at >= $1)
          UNION ALL
          (SELECT coalesce(sum("Earn".msats), 0) as amount
            FROM "Earn"
            WHERE "Earn".msats > 0 AND "Earn"."userId" = $2
            AND "Earn".created_at >= $1)) u`, withinDate(when), Number(user.id))
        return (stacked && msatsToSats(stacked)) || 0
      }
    },
    spent: async (user, { when }, { models }) => {
      if (user.spent) {
        return user.spent
      }

      const { sum: { msats } } = await models.itemAct.aggregate({
        sum: {
          msats: true
        },
        where: {
          userId: user.id,
          createdAt: {
            gte: withinDate(when)
          }
        }
      })

      return (msats && msatsToSats(msats)) || 0
    },
    referrals: async (user, { when }, { models }) => {
      return await models.user.count({
        where: {
          referrerId: user.id,
          createdAt: {
            gte: withinDate(when)
          }
        }
      })
    },
    sats: async (user, args, { models, me }) => {
      if (me?.id !== user.id) {
        return 0
      }
      return msatsToSats(user.msats)
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
    nostrRelays: async (user, args, { models }) => {
      const relays = await models.userNostrRelay.findMany({
        where: { userId: user.id }
      })

      return relays?.map(r => r.nostrRelayAddr)
    }
  }
}
