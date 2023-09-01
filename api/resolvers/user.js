import { GraphQLError } from 'graphql'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { msatsToSats } from '../../lib/format'
import { bioSchema, emailSchema, settingsSchema, ssValidate, userSchema } from '../../lib/validate'
import { getItem, updateItem, filterClause, createItem } from './item'
import { datePivot } from '../../lib/time'

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

export function viewWithin (table, within) {
  let interval = ' AND "' + table + '".day >= date_trunc(\'day\', timezone(\'America/Chicago\', $1 at time zone \'UTC\' - interval '
  switch (within) {
    case 'day':
      interval += "'1 day'))"
      break
    case 'week':
      interval += "'7 days'))"
      break
    case 'month':
      interval += "'1 month'))"
      break
    case 'year':
      interval += "'1 year'))"
      break
    default:
      // HACK: we need to use the time parameter otherwise prisma *cries* about it
      interval = ' AND users.created_at <= $1'
      break
  }
  return interval
}

export function withinDate (within) {
  switch (within) {
    case 'day':
      return datePivot(new Date(), { days: -1 })
    case 'week':
      return datePivot(new Date(), { days: -7 })
    case 'month':
      return datePivot(new Date(), { days: -30 })
    case 'year':
      return datePivot(new Date(), { days: -365 })
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

  const oauth = accounts.map(a => a.provider)

  return {
    lightning: !!user.pubkey,
    email: user.emailVerified && user.email,
    twitter: oauth.indexOf('twitter') >= 0,
    github: oauth.indexOf('github') >= 0,
    nostr: !!user.nostrAuthPubkey
  }
}

export default {
  Query: {
    me: async (parent, { skipUpdate }, { models, me }) => {
      if (!me?.id) {
        return null
      }

      if (!skipUpdate) {
        models.user.update({ where: { id: me.id }, data: { lastSeenAt: new Date() } }).catch(console.error)
      }
      return await models.user.findUnique({ where: { id: me.id } })
    },
    settings: async (parent, args, { models, me }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      return await models.user.findUnique({ where: { id: me.id } })
    },
    user: async (parent, { name }, { models }) => {
      return await models.user.findUnique({ where: { name } })
    },
    users: async (parent, args, { models }) =>
      await models.user.findMany(),
    nameAvailable: async (parent, { name }, { models, me }) => {
      let user
      if (me) {
        user = await models.user.findUnique({ where: { id: me.id } })
      }
      return user?.name?.toUpperCase() === name?.toUpperCase() || !(await models.user.findUnique({ where: { name } }))
    },
    topCowboys: async (parent, { cursor }, { models, me }) => {
      const decodedCursor = decodeCursor(cursor)
      const users = await models.$queryRawUnsafe(`
        SELECT users.*,
          coalesce(floor(sum(msats_spent)/1000),0) as spent,
          coalesce(sum(posts),0) as nposts,
          coalesce(sum(comments),0) as ncomments,
          coalesce(sum(referrals),0) as referrals,
          coalesce(floor(sum(msats_stacked)/1000),0) as stacked
          FROM users
          LEFT JOIN user_stats_days on users.id = user_stats_days.id
          WHERE NOT "hideFromTopUsers" AND NOT "hideCowboyHat" AND streak IS NOT NULL
          GROUP BY users.id
          ORDER BY streak DESC, created_at ASC
          OFFSET $1
          LIMIT ${LIMIT}`, decodedCursor.offset)
      return {
        cursor: users.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        users
      }
    },
    topUsers: async (parent, { cursor, when, by }, { models, me }) => {
      const decodedCursor = decodeCursor(cursor)
      let users

      if (when !== 'day') {
        let column
        switch (by) {
          case 'spent': column = 'spent'; break
          case 'posts': column = 'nposts'; break
          case 'comments': column = 'ncomments'; break
          case 'referrals': column = 'referrals'; break
          default: column = 'stacked'; break
        }

        users = await models.$queryRawUnsafe(`
          WITH u AS (
            SELECT users.*, floor(sum(msats_spent)/1000) as spent,
            sum(posts) as nposts, sum(comments) as ncomments, sum(referrals) as referrals,
            floor(sum(msats_stacked)/1000) as stacked
            FROM user_stats_days
            JOIN users on users.id = user_stats_days.id
            WHERE NOT users."hideFromTopUsers"
            ${viewWithin('user_stats_days', when)}
            GROUP BY users.id
            ORDER BY ${column} DESC NULLS LAST, users.created_at DESC
          )
          SELECT * FROM u WHERE ${column} > 0
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)

        return {
          cursor: users.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
          users
        }
      }

      if (by === 'spent') {
        users = await models.$queryRawUnsafe(`
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
      } else if (by === 'posts') {
        users = await models.$queryRawUnsafe(`
        SELECT users.*, count(*)::INTEGER as nposts
          FROM users
          JOIN "Item" on "Item"."userId" = users.id
          WHERE "Item".created_at <= $1 AND "Item"."parentId" IS NULL
          AND NOT users."hideFromTopUsers"
          ${within('Item', when)}
          GROUP BY users.id
          ORDER BY nposts DESC NULLS LAST, users.created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      } else if (by === 'comments') {
        users = await models.$queryRawUnsafe(`
        SELECT users.*, count(*)::INTEGER as ncomments
          FROM users
          JOIN "Item" on "Item"."userId" = users.id
          WHERE "Item".created_at <= $1 AND "Item"."parentId" IS NOT NULL
          AND NOT users."hideFromTopUsers"
          ${within('Item', when)}
          GROUP BY users.id
          ORDER BY ncomments DESC NULLS LAST, users.created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      } else if (by === 'referrals') {
        users = await models.$queryRawUnsafe(`
          SELECT users.*, count(*)::INTEGER as referrals
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
        users = await models.$queryRawUnsafe(`
          SELECT u.id, u.name, u.streak, u."photoId", u."hideCowboyHat", floor(sum(amount)/1000) as stacked
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
          GROUP BY u.id, u.name, u.created_at, u."photoId", u.streak, u."hideCowboyHat"
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
        const votes = await models.$queryRawUnsafe(`
        SELECT 1
          FROM "Item"
          JOIN "ItemAct" ON
            "ItemAct"."itemId" = "Item".id
            AND "ItemAct"."userId" <> "Item"."userId"
          WHERE "ItemAct".created_at > $2
          AND "Item"."userId" = $1
          AND "ItemAct".act = 'TIP'
          LIMIT 1`, me.id, lastChecked)
        if (votes.length > 0) {
          return true
        }
      }

      // check if they have any replies since checkedNotesAt
      const newReplies = await models.$queryRawUnsafe(`
        SELECT 1
          FROM "Item"
          JOIN "Item" p ON
            "Item".created_at >= p.created_at
            AND ${user.noteAllDescendants ? '"Item".path <@ p.path' : '"Item"."parentId" = p.id'}
            AND "Item"."userId" <> $1
          WHERE p."userId" = $1
          AND "Item".created_at > $2::timestamp(3) without time zone
          ${await filterClause(me, models)}
          LIMIT 1`, me.id, lastChecked)
      if (newReplies.length > 0) {
        return true
      }

      // break out thread subscription to decrease the search space of the already expensive reply query
      const newtsubs = await models.$queryRawUnsafe(`
      SELECT 1
        FROM "ThreadSubscription"
        JOIN "Item" p ON "ThreadSubscription"."itemId" = p.id
        JOIN "Item" ON ${user.noteAllDescendants ? '"Item".path <@ p.path' : '"Item"."parentId" = p.id'}
        WHERE
          "ThreadSubscription"."userId" = $1
        AND "Item".created_at > $2::timestamp(3) without time zone
        ${await filterClause(me, models)}
        LIMIT 1`, me.id, lastChecked)
      if (newtsubs.length > 0) {
        return true
      }

      const newUserSubs = await models.$queryRawUnsafe(`
      SELECT 1
        FROM "UserSubscription"
        JOIN "Item" ON "UserSubscription"."followeeId" = "Item"."userId"
        WHERE
          "UserSubscription"."followerId" = $1
        AND "Item".created_at > $2::timestamp(3) without time zone
        ${await filterClause(me, models)}
        LIMIT 1`, me.id, lastChecked)
      if (newUserSubs.length > 0) {
        return true
      }

      // check if they have any mentions since checkedNotesAt
      if (user.noteMentions) {
        const newMentions = await models.$queryRawUnsafe(`
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
        const newInvitees = await models.$queryRawUnsafe(`
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
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await ssValidate(userSchema, data, models)

      try {
        await models.user.update({ where: { id: me.id }, data })
        return data.name
      } catch (error) {
        if (error.code === 'P2002') {
          throw new GraphQLError('name taken', { extensions: { code: 'BAD_INPUT' } })
        }
        throw error
      }
    },
    setSettings: async (parent, { nostrRelays, ...data }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
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
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await models.user.update({ where: { id: me.id }, data: { upvotePopover, tipPopover } })

      return true
    },
    setPhoto: async (parent, { photoId }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await models.user.update({
        where: { id: me.id },
        data: { photoId: Number(photoId) }
      })

      return Number(photoId)
    },
    upsertBio: async (parent, { bio }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await ssValidate(bioSchema, { bio })

      const user = await models.user.findUnique({ where: { id: me.id } })

      if (user.bioId) {
        await updateItem(parent, { id: user.bioId, text: bio, title: `@${user.name}'s bio` }, { me, models })
      } else {
        await createItem(parent, { bio: true, text: bio, title: `@${user.name}'s bio` }, { me, models })
      }

      return await models.user.findUnique({ where: { id: me.id } })
    },
    unlinkAuth: async (parent, { authType }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      let user
      if (authType === 'twitter' || authType === 'github') {
        user = await models.user.findUnique({ where: { id: me.id } })
        const account = await models.account.findFirst({ where: { userId: me.id, provider: authType } })
        if (!account) {
          throw new GraphQLError('no such account', { extensions: { code: 'BAD_INPUT' } })
        }
        await models.account.delete({ where: { id: account.id } })
      } else if (authType === 'lightning') {
        user = await models.user.update({ where: { id: me.id }, data: { pubkey: null } })
      } else if (authType === 'nostr') {
        user = await models.user.update({ where: { id: me.id }, data: { nostrAuthPubkey: null } })
      } else if (authType === 'email') {
        user = await models.user.update({ where: { id: me.id }, data: { email: null, emailVerified: null } })
      } else {
        throw new GraphQLError('no such account', { extensions: { code: 'BAD_INPUT' } })
      }

      return await authMethods(user, undefined, { models, me })
    },
    linkUnverifiedEmail: async (parent, { email }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await ssValidate(emailSchema, { email })

      try {
        await models.user.update({
          where: { id: me.id },
          data: { email: email.toLowerCase() }
        })
      } catch (error) {
        if (error.code === 'P2002') {
          throw new GraphQLError('email taken', { extensions: { code: 'BAD_INPUT' } })
        }
        throw error
      }

      return true
    },
    subscribeUser: async (parent, { id }, { me, models }) => {
      const data = { followerId: Number(me.id), followeeId: Number(id) }
      const old = await models.userSubscription.findUnique({ where: { followerId_followeeId: data } })
      if (old) {
        await models.userSubscription.delete({ where: { followerId_followeeId: data } })
      } else {
        await models.userSubscription.create({ data })
      }
      return { id }
    },
    csvRequest: async (parent, { csvRequest }, { me, models }) => {
      console.log('mutate csvRequest', csvRequest)
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await models.user.update({ where: { id: me.id }, data: { csvRequest } })
      return csvRequest
    }
  },

  User: {
    csvRequest: async (user, args, { models }) => {
      return user.csvRequest
    },
    csvRequestStatus: async (user, args, { models }) => {
      return user.csvRequestStatus
    },
    authMethods,
    since: async (user, args, { models }) => {
      // get the user's first item
      const item = await models.item.findFirst({
        where: {
          userId: user.id
        },
        orderBy: {
          createdAt: 'asc'
        }
      })
      return item?.id
    },
    maxStreak: async (user, args, { models }) => {
      const [{ max }] = await models.$queryRaw`
      SELECT MAX(COALESCE("endedAt", (now() AT TIME ZONE 'America/Chicago')::date) - "startedAt")
      FROM "Streak" WHERE "userId" = ${user.id}`
      return max
    },
    nitems: async (user, { when }, { models }) => {
      if (typeof user.nitems !== 'undefined') {
        return user.nitems
      }

      return await models.item.count({
        where: {
          userId: user.id,
          createdAt: {
            gte: withinDate(when)
          }
        }
      })
    },
    nposts: async (user, { when }, { models }) => {
      if (typeof user.nposts !== 'undefined') {
        return user.nposts
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
      if (typeof user.ncomments !== 'undefined') {
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
    nbookmarks: async (user, { when }, { models }) => {
      if (typeof user.nBookmarks !== 'undefined') {
        return user.nBookmarks
      }

      return await models.bookmark.count({
        where: {
          userId: user.id,
          createdAt: {
            gte: withinDate(when)
          }
        }
      })
    },
    stacked: async (user, { when }, { models }) => {
      if (typeof user.stacked !== 'undefined') {
        return user.stacked
      }

      if (!when || when === 'forever') {
        // forever
        return (user.stackedMsats && msatsToSats(user.stackedMsats)) || 0
      } else if (when === 'day') {
        const [{ stacked }] = await models.$queryRawUnsafe(`
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

      return 0
    },
    spent: async (user, { when }, { models }) => {
      if (typeof user.spent !== 'undefined') {
        return user.spent
      }

      const { _sum: { msats } } = await models.itemAct.aggregate({
        _sum: {
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
      if (typeof user.referrals !== 'undefined') {
        return user.referrals
      }

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
    bio: async (user, args, { models, me }) => {
      return getItem(user, { id: user.bioId }, { models, me })
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
    },
    meSubscription: async (user, args, { me, models }) => {
      if (!me) return false
      if (typeof user.meSubscription !== 'undefined') return user.meSubscription

      const subscription = await models.userSubscription.findUnique({
        where: {
          followerId_followeeId: {
            followerId: Number(me.id),
            followeeId: Number(user.id)
          }
        }
      })

      return !!subscription
    }
  }
}
