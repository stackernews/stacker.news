import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { GraphQLError } from 'graphql'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { msatsToSats } from '../../lib/format'
import { bioSchema, emailSchema, lnAddrAutowithdrawSchema, settingsSchema, ssValidate, userSchema } from '../../lib/validate'
import { getItem, updateItem, filterClause, createItem, whereClause, muteClause } from './item'
import { ANON_USER_ID, DELETE_USER_ID, RESERVED_MAX_USER_ID } from '../../lib/constants'
import { viewIntervalClause, intervalClause } from './growth'
import { whenRange } from '../../lib/time'

const contributors = new Set()

const loadContributors = async (set) => {
  try {
    const fileContent = await readFile(resolve(join(process.cwd(), 'contributors.txt')), 'utf-8')
    fileContent.split('\n')
      .map(line => line.trim())
      .filter(line => !!line)
      .forEach(name => set.add(name))
  } catch (err) {
    console.error('Error loading contributors', err)
  }
}

async function authMethods (user, args, { models, me }) {
  if (!me || me.id !== user.id) {
    return {
      lightning: false,
      twitter: false,
      github: false,
      nostr: false
    }
  }

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
    me: async (parent, args, { models, me }) => {
      if (!me?.id) {
        return null
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
    userSuggestions: async (parent, { q, limit = 5 }, { models }) => {
      let users = []
      if (q) {
        users = await models.$queryRaw`
          SELECT name
          FROM users
          WHERE (
            id > ${RESERVED_MAX_USER_ID} OR id IN (${ANON_USER_ID}, ${DELETE_USER_ID})
          )
          AND SIMILARITY(name, ${q}) > 0.1
          ORDER BY SIMILARITY(name, ${q}) DESC
          LIMIT ${limit}`
      } else {
        users = await models.$queryRaw`
          SELECT name
          FROM user_stats_days
          JOIN users on users.id = user_stats_days.id
          WHERE NOT users."hideFromTopUsers"
          AND user_stats_days.day = (SELECT max(day) FROM user_stats_days)
          ORDER BY msats_stacked DESC, users.created_at ASC
          LIMIT ${limit}`
      }

      return users
    },
    topUsers: async (parent, { cursor, when, by, from, to, limit = LIMIT }, { models, me }) => {
      const decodedCursor = decodeCursor(cursor)
      const range = whenRange(when, from, to || decodeCursor.time)
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
            AND ${viewIntervalClause(range, 'user_stats_days')}
            GROUP BY users.id
            ORDER BY ${column} DESC NULLS LAST, users.created_at DESC
          )
          SELECT * FROM u WHERE ${column} > 0
          OFFSET $3
          LIMIT $4`, ...range, decodedCursor.offset, limit)

        return {
          cursor: users.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
          users
        }
      }

      if (by === 'spent') {
        users = await models.$queryRawUnsafe(`
          SELECT users.*, sum(sats_spent) as spent
          FROM
          ((SELECT "userId", floor(sum("ItemAct".msats)/1000) as sats_spent
            FROM "ItemAct"
            WHERE ${intervalClause(range, 'ItemAct')}
            GROUP BY "userId")
            UNION ALL
          (SELECT "userId", sats as sats_spent
            FROM "Donation"
            WHERE ${intervalClause(range, 'Donation')})) spending
          JOIN users on spending."userId" = users.id
          AND NOT users."hideFromTopUsers"
          GROUP BY users.id, users.name
          ORDER BY spent DESC NULLS LAST, users.created_at DESC
          OFFSET $3
          LIMIT $4`, ...range, decodedCursor.offset, limit)
      } else if (by === 'posts') {
        users = await models.$queryRawUnsafe(`
        SELECT users.*, count(*)::INTEGER as nposts
          FROM users
          JOIN "Item" on "Item"."userId" = users.id
          WHERE "Item"."parentId" IS NULL
          AND NOT users."hideFromTopUsers"
          AND ${intervalClause(range, 'Item')}
          GROUP BY users.id
          ORDER BY nposts DESC NULLS LAST, users.created_at DESC
          OFFSET $3
          LIMIT $4`, ...range, decodedCursor.offset, limit)
      } else if (by === 'comments') {
        users = await models.$queryRawUnsafe(`
        SELECT users.*, count(*)::INTEGER as ncomments
          FROM users
          JOIN "Item" on "Item"."userId" = users.id
          WHERE "Item"."parentId" IS NOT NULL
          AND NOT users."hideFromTopUsers"
          AND ${intervalClause(range, 'Item')}
          GROUP BY users.id
          ORDER BY ncomments DESC NULLS LAST, users.created_at DESC
          OFFSET $3
          LIMIT $4`, ...range, decodedCursor.offset, limit)
      } else if (by === 'referrals') {
        users = await models.$queryRawUnsafe(`
          SELECT users.*, count(*)::INTEGER as referrals
          FROM users
          JOIN "users" referree on users.id = referree."referrerId"
          AND NOT users."hideFromTopUsers"
          AND ${intervalClause(range, 'referree')}
          GROUP BY users.id
          ORDER BY referrals DESC NULLS LAST, users.created_at DESC
          OFFSET $3
          LIMIT $4`, ...range, decodedCursor.offset, limit)
      } else {
        users = await models.$queryRawUnsafe(`
          SELECT u.id, u.name, u.streak, u."photoId", u."hideCowboyHat", floor(sum(amount)/1000) as stacked
          FROM
          ((SELECT users.*, "ItemAct".msats as amount
            FROM "ItemAct"
            JOIN "Item" on "ItemAct"."itemId" = "Item".id
            JOIN users on "Item"."userId" = users.id
            WHERE act <> 'BOOST' AND "ItemAct"."userId" <> users.id
            AND NOT users."hideFromTopUsers"
            AND ${intervalClause(range, 'ItemAct')})
          UNION ALL
          (SELECT users.*, "Earn".msats as amount
            FROM "Earn"
            JOIN users on users.id = "Earn"."userId"
            WHERE "Earn".msats > 0
            AND ${intervalClause(range, 'Earn')}
            AND NOT users."hideFromTopUsers")
          UNION ALL
          (SELECT users.*, "ReferralAct".msats as amount
              FROM "ReferralAct"
              JOIN users on users.id = "ReferralAct"."referrerId"
              WHERE "ReferralAct".msats > 0
              AND ${intervalClause(range, 'ReferralAct')}
              AND NOT users."hideFromTopUsers")) u
          GROUP BY u.id, u.name, u.created_at, u."photoId", u.streak, u."hideCowboyHat"
          ORDER BY stacked DESC NULLS LAST, created_at DESC
          OFFSET $3
          LIMIT $4`, ...range, decodedCursor.offset, limit)
      }

      return {
        cursor: users.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
        users
      }
    },
    hasNewNotes: async (parent, args, { me, models }) => {
      if (!me) {
        return false
      }
      const user = await models.user.findUnique({ where: { id: me.id } })
      const lastChecked = user.checkedNotesAt || new Date(0)

      // if we've already recorded finding notes after they last checked, return true
      // this saves us from rechecking notifications
      if (user.foundNotesAt > lastChecked) {
        return true
      }

      const foundNotes = () =>
        models.user.update({
          where: { id: me.id },
          data: {
            foundNotesAt: new Date(),
            lastSeenAt: new Date()
          }
        }).catch(console.error)

      // check if any votes have been cast for them since checkedNotesAt
      if (user.noteItemSats) {
        const [newSats] = await models.$queryRawUnsafe(`
          SELECT EXISTS(
            SELECT *
            FROM "Item"
            JOIN "ItemAct" ON
              "ItemAct"."itemId" = "Item".id
              AND "ItemAct"."userId" <> "Item"."userId"
            WHERE "ItemAct".created_at > $2
            AND "Item"."userId" = $1
            AND "ItemAct".act = 'TIP')`, me.id, lastChecked)
        if (newSats.exists) {
          foundNotes()
          return true
        }
      }

      // break out thread subscription to decrease the search space of the already expensive reply query
      const [newThreadSubReply] = await models.$queryRawUnsafe(`
        SELECT EXISTS(
          SELECT *
          FROM "ThreadSubscription"
          JOIN "Item" p ON "ThreadSubscription"."itemId" = p.id
          JOIN "Item" ON ${user.noteAllDescendants ? '"Item".path <@ p.path' : '"Item"."parentId" = p.id'}
          ${whereClause(
            '"ThreadSubscription"."userId" = $1',
            '"Item".created_at > $2',
            '"Item".created_at >= "ThreadSubscription".created_at',
            '"Item"."userId" <> $1',
            await filterClause(me, models),
            muteClause(me)
          )})`, me.id, lastChecked)
      if (newThreadSubReply.exists) {
        foundNotes()
        return true
      }

      const [newUserSubs] = await models.$queryRawUnsafe(`
        SELECT EXISTS(
          SELECT *
          FROM "UserSubscription"
          JOIN "Item" ON "UserSubscription"."followeeId" = "Item"."userId"
          ${whereClause(
            '"UserSubscription"."followerId" = $1',
            '"Item".created_at > $2',
            `(
              ("Item"."parentId" IS NULL AND "UserSubscription"."postsSubscribedAt" IS NOT NULL AND "Item".created_at >= "UserSubscription"."postsSubscribedAt")
              OR ("Item"."parentId" IS NOT NULL AND "UserSubscription"."commentsSubscribedAt" IS NOT NULL AND "Item".created_at >= "UserSubscription"."commentsSubscribedAt")
            )`,
            await filterClause(me, models),
            muteClause(me))})`, me.id, lastChecked)
      if (newUserSubs.exists) {
        foundNotes()
        return true
      }

      // check if they have any mentions since checkedNotesAt
      if (user.noteMentions) {
        const [newMentions] = await models.$queryRawUnsafe(`
        SELECT EXISTS(
          SELECT *
          FROM "Mention"
          JOIN "Item" ON "Mention"."itemId" = "Item".id
          ${whereClause(
            '"Mention"."userId" = $1',
            '"Mention".created_at > $2',
            '"Item"."userId" <> $1',
            await filterClause(me, models),
            muteClause(me)
          )})`, me.id, lastChecked)
        if (newMentions.exists) {
          foundNotes()
          return true
        }
      }

      if (user.noteForwardedSats) {
        const [newFwdSats] = await models.$queryRawUnsafe(`
        SELECT EXISTS(
          SELECT *
          FROM "Item"
          JOIN "ItemAct" ON
            "ItemAct"."itemId" = "Item".id
            AND "ItemAct"."userId" <> "Item"."userId"
          JOIN "ItemForward" ON
            "ItemForward"."itemId" = "Item".id
            AND "ItemForward"."userId" = $1
          WHERE "ItemAct".created_at > $2
          AND "Item"."userId" <> $1
          AND "ItemAct".act = 'TIP')`, me.id, lastChecked)
        if (newFwdSats.exists) {
          foundNotes()
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
        foundNotes()
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
          foundNotes()
          return true
        }
      }

      if (user.noteDeposits) {
        const invoice = await models.invoice.findFirst({
          where: {
            userId: me.id,
            confirmedAt: {
              gt: lastChecked
            },
            isHeld: null
          }
        })
        if (invoice) {
          foundNotes()
          return true
        }
      }

      // check if new invites have been redeemed
      if (user.noteInvites) {
        const [newInvites] = await models.$queryRawUnsafe(`
          SELECT EXISTS(
            SELECT *
            FROM users JOIN "Invite" on users."inviteId" = "Invite".id
            WHERE "Invite"."userId" = $1
            AND users.created_at > $2)`, me.id, lastChecked)
        if (newInvites.exists) {
          foundNotes()
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
          foundNotes()
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
          foundNotes()
          return true
        }
      }

      const subStatus = await models.sub.findFirst({
        where: {
          userId: me.id,
          statusUpdatedAt: {
            gt: lastChecked
          },
          status: {
            not: 'ACTIVE'
          }
        }
      })

      if (subStatus) {
        foundNotes()
        return true
      }

      // update checkedNotesAt to prevent rechecking same time period
      models.user.update({
        where: { id: me.id },
        data: {
          checkedNotesAt: new Date(),
          lastSeenAt: new Date()
        }
      }).catch(console.error)

      return false
    },
    searchUsers: async (parent, { q, limit, similarity }, { models }) => {
      return await models.$queryRaw`
        SELECT *
        FROM users
        WHERE (id > ${RESERVED_MAX_USER_ID} OR id IN (${ANON_USER_ID}, ${DELETE_USER_ID}))
        AND SIMILARITY(name, ${q}) > ${Number(similarity) || 0.1} ORDER BY SIMILARITY(name, ${q}) DESC LIMIT ${Number(limit) || 5}`
    }
  },

  Mutation: {
    setName: async (parent, data, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await ssValidate(userSchema, data, { models })

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
    setAutoWithdraw: async (parent, data, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await ssValidate(lnAddrAutowithdrawSchema, data, { me, models })

      await models.user.update({
        where: { id: me.id },
        data
      })

      return true
    },
    removeAutoWithdraw: async (parent, data, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await models.user.update({
        where: { id: me.id },
        data: {
          lnAddr: null,
          autoWithdrawThreshold: null,
          autoWithdrawMaxFeePercent: null
        }
      })

      return true
    },
    setSettings: async (parent, { settings: { nostrRelays, ...data } }, { me, models }) => {
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
    subscribeUserPosts: async (parent, { id }, { me, models }) => {
      const lookupData = { followerId: Number(me.id), followeeId: Number(id) }
      const existing = await models.userSubscription.findUnique({ where: { followerId_followeeId: lookupData } })
      if (existing) {
        await models.userSubscription.update({ where: { followerId_followeeId: lookupData }, data: { postsSubscribedAt: existing.postsSubscribedAt ? null : new Date() } })
      } else {
        await models.userSubscription.create({ data: { ...lookupData, postsSubscribedAt: new Date() } })
      }
      return { id }
    },
    subscribeUserComments: async (parent, { id }, { me, models }) => {
      const lookupData = { followerId: Number(me.id), followeeId: Number(id) }
      const existing = await models.userSubscription.findUnique({ where: { followerId_followeeId: lookupData } })
      if (existing) {
        await models.userSubscription.update({ where: { followerId_followeeId: lookupData }, data: { commentsSubscribedAt: existing.commentsSubscribedAt ? null : new Date() } })
      } else {
        await models.userSubscription.create({ data: { ...lookupData, commentsSubscribedAt: new Date() } })
      }
      return { id }
    },
    toggleMute: async (parent, { id }, { me, models }) => {
      const lookupData = { muterId: Number(me.id), mutedId: Number(id) }
      const where = { muterId_mutedId: lookupData }
      const existing = await models.mute.findUnique({ where })
      if (existing) {
        await models.mute.delete({ where })
      } else {
        await models.mute.create({ data: { ...lookupData } })
      }
      return { id }
    },
    hideWelcomeBanner: async (parent, data, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await models.user.update({ where: { id: me.id }, data: { hideWelcomeBanner: true } })
      return true
    }
  },

  User: {
    privates: async (user, args, { me, models }) => {
      if (!me || me.id !== user.id) {
        return null
      }

      return user
    },
    optional: user => user,
    meSubscriptionPosts: async (user, args, { me, models }) => {
      if (!me) return false
      if (typeof user.meSubscriptionPosts !== 'undefined') return user.meSubscriptionPosts

      const subscription = await models.userSubscription.findUnique({
        where: {
          followerId_followeeId: {
            followerId: Number(me.id),
            followeeId: Number(user.id)
          }
        }
      })

      return !!subscription?.postsSubscribedAt
    },
    meSubscriptionComments: async (user, args, { me, models }) => {
      if (!me) return false
      if (typeof user.meSubscriptionComments !== 'undefined') return user.meSubscriptionComments

      const subscription = await models.userSubscription.findUnique({
        where: {
          followerId_followeeId: {
            followerId: Number(me.id),
            followeeId: Number(user.id)
          }
        }
      })

      return !!subscription?.commentsSubscribedAt
    },
    meMute: async (user, args, { me, models }) => {
      if (!me) return false
      if (typeof user.meMute !== 'undefined') return user.meMute

      const mute = await models.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: Number(me.id),
            mutedId: Number(user.id)
          }
        }
      })

      return !!mute
    },
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
    nitems: async (user, { when, from, to }, { models }) => {
      if (typeof user.nitems !== 'undefined') {
        return user.nitems
      }

      const [gte, lte] = whenRange(when, from, to)
      return await models.item.count({
        where: {
          userId: user.id,
          createdAt: {
            gte,
            lte
          }
        }
      })
    },
    nposts: async (user, { when, from, to }, { models }) => {
      if (typeof user.nposts !== 'undefined') {
        return user.nposts
      }

      const [gte, lte] = whenRange(when, from, to)
      return await models.item.count({
        where: {
          userId: user.id,
          parentId: null,
          createdAt: {
            gte,
            lte
          }
        }
      })
    },
    ncomments: async (user, { when, from, to }, { models }) => {
      if (typeof user.ncomments !== 'undefined') {
        return user.ncomments
      }

      const [gte, lte] = whenRange(when, from, to)
      return await models.item.count({
        where: {
          userId: user.id,
          parentId: { not: null },
          createdAt: {
            gte,
            lte
          }
        }
      })
    },
    bio: async (user, args, { models, me }) => {
      return getItem(user, { id: user.bioId }, { models, me })
    }
  },

  UserPrivates: {
    sats: async (user, args, { models, me }) => {
      if (!me || me.id !== user.id) {
        return 0
      }
      return msatsToSats(user.msats)
    },
    authMethods,
    hasInvites: async (user, args, { models }) => {
      const invites = await models.user.findUnique({
        where: { id: user.id }
      }).invites({ take: 1 })

      return invites.length > 0
    },
    nostrRelays: async (user, args, { models, me }) => {
      if (user.id !== me.id) {
        return []
      }

      const relays = await models.userNostrRelay.findMany({
        where: { userId: user.id }
      })

      return relays?.map(r => r.nostrRelayAddr)
    }
  },

  UserOptional: {
    streak: async (user, args, { models }) => {
      if (user.hideCowboyHat) {
        return null
      }

      return user.streak
    },
    maxStreak: async (user, args, { models }) => {
      if (user.hideCowboyHat) {
        return null
      }

      const [{ max }] = await models.$queryRaw`
        SELECT MAX(COALESCE("endedAt", (now() AT TIME ZONE 'America/Chicago')::date) - "startedAt")
        FROM "Streak" WHERE "userId" = ${user.id}`
      return max
    },
    isContributor: async (user, args, { me }) => {
      // lazy init contributors only once
      if (contributors.size === 0) {
        await loadContributors(contributors)
      }
      if (me?.id === user.id) {
        return contributors.has(user.name)
      }
      return !user.hideIsContributor && contributors.has(user.name)
    },
    stacked: async (user, { when, from, to }, { models, me }) => {
      if ((!me || me.id !== user.id) && user.hideFromTopUsers) {
        return null
      }

      if (typeof user.stacked !== 'undefined') {
        return user.stacked
      }

      if (!when || when === 'forever') {
        // forever
        return (user.stackedMsats && msatsToSats(user.stackedMsats)) || 0
      } else if (when === 'day') {
        const range = whenRange(when, from, to)
        const [{ stacked }] = await models.$queryRawUnsafe(`
          SELECT sum(amount) as stacked
          FROM
          ((SELECT coalesce(sum("ItemAct".msats),0) as amount
            FROM "ItemAct"
            JOIN "Item" on "ItemAct"."itemId" = "Item".id
            WHERE act = 'TIP' AND "ItemAct"."userId" <> $3 AND "Item"."userId" = $3
            AND ${intervalClause(range, 'ItemAct')})
          UNION ALL
            (SELECT coalesce(sum("ReferralAct".msats),0) as amount
              FROM "ReferralAct"
              WHERE "ReferralAct".msats > 0 AND "ReferralAct"."referrerId" = $3
              AND ${intervalClause(range, 'ReferralAct')})
          UNION ALL
          (SELECT coalesce(sum("Earn".msats), 0) as amount
            FROM "Earn"
            WHERE "Earn".msats > 0 AND "Earn"."userId" = $3
            AND ${intervalClause(range, 'Earn')})) u`, ...range, Number(user.id))
        return (stacked && msatsToSats(stacked)) || 0
      }

      return 0
    },
    spent: async (user, { when, from, to }, { models, me }) => {
      if ((!me || me.id !== user.id) && user.hideFromTopUsers) {
        return null
      }

      if (typeof user.spent !== 'undefined') {
        return user.spent
      }

      const [gte, lte] = whenRange(when, from, to)
      const { _sum: { msats } } = await models.itemAct.aggregate({
        _sum: {
          msats: true
        },
        where: {
          userId: user.id,
          createdAt: {
            gte,
            lte
          }
        }
      })

      return (msats && msatsToSats(msats)) || 0
    },
    referrals: async (user, { when, from, to }, { models, me }) => {
      if ((!me || me.id !== user.id) && user.hideFromTopUsers) {
        return null
      }

      if (typeof user.referrals !== 'undefined') {
        return user.referrals
      }

      const [gte, lte] = whenRange(when, from, to)
      return await models.user.count({
        where: {
          referrerId: user.id,
          createdAt: {
            gte,
            lte
          }
        }
      })
    }
  }
}
