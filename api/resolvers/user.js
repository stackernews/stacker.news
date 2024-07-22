import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { GraphQLError } from 'graphql'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { msatsToSats } from '@/lib/format'
import { bioSchema, emailSchema, settingsSchema, ssValidate, userSchema } from '@/lib/validate'
import { getItem, updateItem, filterClause, createItem, whereClause, muteClause, activeOrMine } from './item'
import { USER_ID, RESERVED_MAX_USER_ID, SN_NO_REWARDS_IDS, INVOICE_ACTION_NOTIFICATION_TYPES } from '@/lib/constants'
import { viewGroup } from './growth'
import { timeUnitForRange, whenRange } from '@/lib/time'
import assertApiKeyNotPermitted from './apiKey'
import { hashEmail } from '@/lib/crypto'
import { isMuted } from '@/lib/user'

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
    email: !!(user.emailVerified && user.emailHash),
    twitter: oauth.indexOf('twitter') >= 0,
    github: oauth.indexOf('github') >= 0,
    nostr: !!user.nostrAuthPubkey,
    apiKey: user.apiKeyEnabled ? !!user.apiKeyHash : null
  }
}

export async function topUsers (parent, { cursor, when, by, from, to, limit = LIMIT }, { models, me }) {
  const decodedCursor = decodeCursor(cursor)
  const range = whenRange(when, from, to || decodeCursor.time)

  let column
  switch (by) {
    case 'spending':
    case 'spent': column = 'spent'; break
    case 'posts': column = 'nposts'; break
    case 'comments': column = 'ncomments'; break
    case 'referrals': column = 'referrals'; break
    case 'stacking': column = 'stacked'; break
    default: column = 'proportion'; break
  }

  const users = (await models.$queryRawUnsafe(`
    SELECT *
    FROM
      (SELECT users.*,
        COALESCE(floor(sum(msats_spent)/1000), 0) as spent,
        COALESCE(sum(posts), 0) as nposts,
        COALESCE(sum(comments), 0) as ncomments,
        COALESCE(sum(referrals), 0) as referrals,
        COALESCE(floor(sum(msats_stacked)/1000), 0) as stacked
      FROM ${viewGroup(range, 'user_stats')}
      JOIN users on users.id = u.id
      GROUP BY users.id) uu
      ${column === 'proportion' ? `JOIN ${viewValueGroup()} ON uu.id = vv.id` : ''}
      ORDER BY ${column} DESC NULLS LAST, uu.created_at ASC
      OFFSET $3
      LIMIT $4`, ...range, decodedCursor.offset, limit)
  ).map(
    u => u.hideFromTopUsers && (!me || me.id !== u.id) ? null : u
  )

  return {
    cursor: users.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
    users
  }
}

export function viewValueGroup () {
  return `(
    SELECT v.id, sum(proportion) as proportion
    FROM (
      (SELECT *
        FROM user_values_days
        WHERE user_values_days.t >= date_trunc('day', timezone('America/Chicago', $1))
        AND date_trunc('day', user_values_days.t) <= date_trunc('day', timezone('America/Chicago', $2)))
      UNION ALL
      (SELECT * FROM
        user_values_today
        WHERE user_values_today.t >= date_trunc('day', timezone('America/Chicago', $1))
        AND date_trunc('day', user_values_today.t) <= date_trunc('day', timezone('America/Chicago', $2)))
      ) v
    WHERE v.id NOT IN (${SN_NO_REWARDS_IDS.join(',')})
    GROUP BY v.id
  ) vv`
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
    mySubscribedUsers: async (parent, { cursor }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('You must be logged in to view subscribed users', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      const decodedCursor = decodeCursor(cursor)
      const users = await models.$queryRaw`
        SELECT users.*
        FROM "UserSubscription"
        JOIN users ON "UserSubscription"."followeeId" = users.id
        WHERE "UserSubscription"."followerId" = ${me.id}
        AND ("UserSubscription"."postsSubscribedAt" IS NOT NULL OR "UserSubscription"."commentsSubscribedAt" IS NOT NULL)
        OFFSET ${decodedCursor.offset}
        LIMIT ${LIMIT}
      `

      return {
        cursor: users.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        users
      }
    },
    myMutedUsers: async (parent, { cursor }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('You must be logged in to view muted users', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      const decodedCursor = decodeCursor(cursor)
      const users = await models.$queryRaw`
        SELECT users.*
        FROM "Mute"
        JOIN users ON "Mute"."mutedId" = users.id
        WHERE "Mute"."muterId" = ${me.id}
        OFFSET ${decodedCursor.offset}
        LIMIT ${LIMIT}
      `

      return {
        cursor: users.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        users
      }
    },
    topCowboys: async (parent, { cursor }, { models, me }) => {
      const decodedCursor = decodeCursor(cursor)
      const range = whenRange('forever')

      const users = (await models.$queryRawUnsafe(`
        SELECT users.*,
          coalesce(floor(sum(msats_spent)/1000),0) as spent,
          coalesce(sum(posts),0) as nposts,
          coalesce(sum(comments),0) as ncomments,
          coalesce(sum(referrals),0) as referrals,
          coalesce(floor(sum(msats_stacked)/1000),0) as stacked
          FROM ${viewGroup(range, 'user_stats')}
          JOIN users on users.id = u.id
          WHERE streak IS NOT NULL
          GROUP BY users.id
          ORDER BY streak DESC, created_at ASC
          OFFSET $3
          LIMIT ${LIMIT}`, ...range, decodedCursor.offset)
      ).map(
        u => (u.hideFromTopUsers || u.hideCowboyHat) && (!me || me.id !== u.id) ? null : u
      )

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
            id > ${RESERVED_MAX_USER_ID} OR id IN (${USER_ID.anon}, ${USER_ID.delete})
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
          AND user_stats_days.t = (SELECT max(t) FROM user_stats_days)
          ORDER BY msats_stacked DESC, users.created_at ASC
          LIMIT ${limit}`
      }

      return users
    },
    topUsers,
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
            WHERE "Item"."lastZapAt" > $2
            AND "Item"."userId" = $1)`, me.id, lastChecked)
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
          JOIN "Reply" r ON "ThreadSubscription"."itemId" = r."ancestorId"
          JOIN "Item" ON r."itemId" = "Item".id
          ${whereClause(
            '"ThreadSubscription"."userId" = $1',
            'r.created_at > $2',
            'r.created_at >= "ThreadSubscription".created_at',
            'r."userId" <> $1',
            activeOrMine(me),
            await filterClause(me, models),
            muteClause(me),
            ...(user.noteAllDescendants ? [] : ['r.level = 1'])
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
            activeOrMine(me),
            await filterClause(me, models),
            muteClause(me))})`, me.id, lastChecked)
      if (newUserSubs.exists) {
        foundNotes()
        return true
      }

      const [newSubPost] = await models.$queryRawUnsafe(`
        SELECT EXISTS(
          SELECT *
          FROM "SubSubscription"
          JOIN "Item" ON "SubSubscription"."subName" = "Item"."subName"
          ${whereClause(
            '"SubSubscription"."userId" = $1',
            '"Item".created_at > $2',
            '"Item"."parentId" IS NULL',
            '"Item"."userId" <> $1',
            activeOrMine(me),
            await filterClause(me, models),
            muteClause(me))})`, me.id, lastChecked)
      if (newSubPost.exists) {
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
            activeOrMine(me),
            await filterClause(me, models),
            muteClause(me)
          )})`, me.id, lastChecked)
        if (newMentions.exists) {
          foundNotes()
          return true
        }
      }

      if (user.noteItemMentions) {
        const [newMentions] = await models.$queryRawUnsafe(`
        SELECT EXISTS(
          SELECT *
          FROM "ItemMention"
          JOIN "Item" "Referee" ON "ItemMention"."refereeId" = "Referee".id
          JOIN "Item" ON "ItemMention"."referrerId" = "Item".id
          ${whereClause(
            '"ItemMention".created_at > $2',
            '"Item"."userId" <> $1',
            '"Referee"."userId" = $1',
            activeOrMine(me),
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
          JOIN "ItemForward" ON
            "ItemForward"."itemId" = "Item".id
            AND "ItemForward"."userId" = $1
          ${whereClause(
            '"Item"."lastZapAt" > $2',
            '"Item"."userId" <> $1',
            activeOrMine(me),
            await filterClause(me, models),
            muteClause(me)
          )})`, me.id, lastChecked)
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
            isHeld: null,
            actionType: null
          }
        })
        if (invoice) {
          foundNotes()
          return true
        }
      }

      if (user.noteWithdrawals) {
        const wdrwl = await models.withdrawl.findFirst({
          where: {
            userId: me.id,
            status: 'CONFIRMED',
            updatedAt: {
              gt: lastChecked
            }
          }
        })
        if (wdrwl) {
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

      const newReminder = await models.reminder.findFirst({
        where: {
          userId: me.id,
          remindAt: {
            gt: lastChecked,
            lt: new Date()
          }
        }
      })
      if (newReminder) {
        foundNotes()
        return true
      }

      const invoiceActionFailed = await models.invoice.findFirst({
        where: {
          userId: me.id,
          updatedAt: {
            gt: lastChecked
          },
          actionType: {
            in: INVOICE_ACTION_NOTIFICATION_TYPES
          },
          actionState: 'FAILED'
        }
      })

      if (invoiceActionFailed) {
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
        WHERE (id > ${RESERVED_MAX_USER_ID} OR id IN (${USER_ID.anon}, ${USER_ID.delete}))
        AND SIMILARITY(name, ${q}) > ${Number(similarity) || 0.1} ORDER BY SIMILARITY(name, ${q}) DESC LIMIT ${Number(limit) || 5}`
    },
    userStatsActions: async (parent, { when, from, to }, { me, models }) => {
      const range = whenRange(when, from, to)
      return await models.$queryRawUnsafe(`
      SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time,
      json_build_array(
        json_build_object('name', 'comments', 'value', COALESCE(SUM(comments), 0)),
        json_build_object('name', 'posts', 'value', COALESCE(SUM(posts), 0)),
        json_build_object('name', 'territories', 'value', COALESCE(SUM(territories), 0)),
        json_build_object('name', 'referrals', 'value', COALESCE(SUM(referrals), 0)),
        json_build_object('name', 'one day referrals', 'value', COALESCE(SUM(one_day_referrals), 0))
      ) AS data
        FROM ${viewGroup(range, 'user_stats')}
        WHERE id = ${me.id}
        GROUP BY time
        ORDER BY time ASC`, ...range)
    },
    userStatsIncomingSats: async (parent, { when, from, to }, { me, models }) => {
      const range = whenRange(when, from, to)
      return await models.$queryRawUnsafe(`
      SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time,
      json_build_array(
        json_build_object('name', 'zaps', 'value', ROUND(COALESCE(SUM(msats_tipped), 0) / 1000)),
        json_build_object('name', 'rewards', 'value', ROUND(COALESCE(SUM(msats_rewards), 0) / 1000)),
        json_build_object('name', 'referrals', 'value', ROUND( COALESCE(SUM(msats_referrals), 0) / 1000)),
        json_build_object('name', 'one day referrals', 'value', ROUND( COALESCE(SUM(msats_one_day_referrals), 0) / 1000)),
        json_build_object('name', 'territories', 'value', ROUND(COALESCE(SUM(msats_revenue), 0) / 1000))
      ) AS data
        FROM ${viewGroup(range, 'user_stats')}
        WHERE id = ${me.id}
        GROUP BY time
        ORDER BY time ASC`, ...range)
    },
    userStatsOutgoingSats: async (parent, { when, from, to }, { me, models }) => {
      const range = whenRange(when, from, to)
      return await models.$queryRawUnsafe(`
      SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time,
      json_build_array(
        json_build_object('name', 'fees', 'value', FLOOR(COALESCE(SUM(msats_fees), 0) / 1000)),
        json_build_object('name', 'zapping', 'value', FLOOR(COALESCE(SUM(msats_zaps), 0) / 1000)),
        json_build_object('name', 'donations', 'value', FLOOR(COALESCE(SUM(msats_donated), 0) / 1000)),
        json_build_object('name', 'territories', 'value', FLOOR(COALESCE(SUM(msats_billing), 0) / 1000))
      ) AS data
      FROM ${viewGroup(range, 'user_stats')}
      WHERE id = ${me.id}
      GROUP BY time
      ORDER BY time ASC`, ...range)
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
    generateApiKey: async (parent, { id }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      const user = await models.user.findUnique({ where: { id: me.id } })
      if (!user.apiKeyEnabled) {
        throw new GraphQLError('you are not allowed to generate api keys', { extensions: { code: 'FORBIDDEN' } })
      }

      // I trust postgres CSPRNG more than the one from JS
      const [{ apiKey, apiKeyHash }] = await models.$queryRaw`
      SELECT "apiKey", encode(digest("apiKey", 'sha256'), 'hex') AS "apiKeyHash"
      FROM (
        SELECT encode(gen_random_bytes(32), 'base64')::CHAR(32) as "apiKey"
      ) rng`
      await models.user.update({ where: { id: me.id }, data: { apiKeyHash } })

      return apiKey
    },
    deleteApiKey: async (parent, { id }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      return await models.user.update({ where: { id: me.id }, data: { apiKeyHash: null } })
    },
    unlinkAuth: async (parent, { authType }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }
      assertApiKeyNotPermitted({ me })

      let user
      if (authType === 'twitter' || authType === 'github') {
        user = await models.user.findUnique({ where: { id: me.id } })
        const account = await models.account.findFirst({ where: { userId: me.id, provider: authType } })
        if (!account) {
          throw new GraphQLError('no such account', { extensions: { code: 'BAD_INPUT' } })
        }
        await models.account.delete({ where: { id: account.id } })
        if (authType === 'twitter') {
          await models.user.update({ where: { id: me.id }, data: { hideTwitter: true, twitterId: null } })
        } else {
          await models.user.update({ where: { id: me.id }, data: { hideGithub: true, githubId: null } })
        }
      } else if (authType === 'lightning') {
        user = await models.user.update({ where: { id: me.id }, data: { pubkey: null } })
      } else if (authType === 'nostr') {
        user = await models.user.update({ where: { id: me.id }, data: { hideNostr: true, nostrAuthPubkey: null } })
      } else if (authType === 'email') {
        user = await models.user.update({ where: { id: me.id }, data: { email: null, emailVerified: null, emailHash: null } })
      } else {
        throw new GraphQLError('no such account', { extensions: { code: 'BAD_INPUT' } })
      }

      return await authMethods(user, undefined, { models, me })
    },
    linkUnverifiedEmail: async (parent, { email }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }
      assertApiKeyNotPermitted({ me })

      await ssValidate(emailSchema, { email })

      try {
        await models.user.update({
          where: { id: me.id },
          data: { emailHash: hashEmail({ email }) }
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
      const muted = await isMuted({ models, muterId: me?.id, mutedId: id })
      if (existing) {
        if (muted && !existing.postsSubscribedAt) {
          throw new GraphQLError("you can't subscribe to a stacker that you've muted", { extensions: { code: 'BAD_INPUT' } })
        }
        await models.userSubscription.update({ where: { followerId_followeeId: lookupData }, data: { postsSubscribedAt: existing.postsSubscribedAt ? null : new Date() } })
      } else {
        if (muted) {
          throw new GraphQLError("you can't subscribe to a stacker that you've muted", { extensions: { code: 'BAD_INPUT' } })
        }
        await models.userSubscription.create({ data: { ...lookupData, postsSubscribedAt: new Date() } })
      }
      return { id }
    },
    subscribeUserComments: async (parent, { id }, { me, models }) => {
      const lookupData = { followerId: Number(me.id), followeeId: Number(id) }
      const existing = await models.userSubscription.findUnique({ where: { followerId_followeeId: lookupData } })
      const muted = await isMuted({ models, muterId: me?.id, mutedId: id })
      if (existing) {
        if (muted && !existing.commentsSubscribedAt) {
          throw new GraphQLError("you can't subscribe to a stacker that you've muted", { extensions: { code: 'BAD_INPUT' } })
        }
        await models.userSubscription.update({ where: { followerId_followeeId: lookupData }, data: { commentsSubscribedAt: existing.commentsSubscribedAt ? null : new Date() } })
      } else {
        if (muted) {
          throw new GraphQLError("you can't subscribe to a stacker that you've muted", { extensions: { code: 'BAD_INPUT' } })
        }
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
        // check to see if current user is subscribed to the target user, and disallow mute if so
        const subscription = await models.userSubscription.findUnique({
          where: {
            followerId_followeeId: {
              followerId: Number(me.id),
              followeeId: Number(id)
            }
          }
        })
        if (subscription?.postsSubscribedAt || subscription?.commentsSubscribedAt) {
          throw new GraphQLError("you can't mute a stacker to whom you've subscribed", { extensions: { code: 'BAD_INPUT' } })
        }
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

      return await isMuted({ models, muterId: me.id, mutedId: user.id })
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
    nterritories: async (user, { when, from, to }, { models }) => {
      if (typeof user.nterritories !== 'undefined') {
        return user.nterritories
      }

      const [gte, lte] = whenRange(when, from, to)
      return await models.sub.count({
        where: {
          userId: user.id,
          status: 'ACTIVE',
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
      }

      const range = whenRange(when, from, to)
      const [{ stacked }] = await models.$queryRawUnsafe(`
        SELECT sum(msats_stacked) as stacked
        FROM ${viewGroup(range, 'user_stats')}
        WHERE id = $3`, ...range, Number(user.id))
      return (stacked && msatsToSats(stacked)) || 0
    },
    spent: async (user, { when, from, to }, { models, me }) => {
      if ((!me || me.id !== user.id) && user.hideFromTopUsers) {
        return null
      }

      if (typeof user.spent !== 'undefined') {
        return user.spent
      }

      const range = whenRange(when, from, to)
      const [{ spent }] = await models.$queryRawUnsafe(`
        SELECT sum(msats_spent) as spent
        FROM ${viewGroup(range, 'user_stats')}
        WHERE id = $3`, ...range, Number(user.id))

      return (spent && msatsToSats(spent)) || 0
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
    },
    githubId: async (user, args, { me }) => {
      if ((!me || me.id !== user.id) && user.hideGithub) {
        return null
      }
      return user.githubId
    },
    twitterId: async (user, args, { models, me }) => {
      if ((!me || me.id !== user.id) && user.hideTwitter) {
        return null
      }
      return user.twitterId
    },
    nostrAuthPubkey: async (user, args, { models, me }) => {
      if ((!me || me.id !== user.id) && user.hideNostr) {
        return null
      }
      return user.nostrAuthPubkey
    }
  }
}
