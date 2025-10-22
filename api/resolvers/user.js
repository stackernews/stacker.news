import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { msatsToSats } from '@/lib/format'
import { bioSchema, emailSchema, settingsSchema, validateSchema, userSchema } from '@/lib/validate'
import { getItem, updateItem, filterClause, createItem, whereClause, muteClause, activeOrMine } from './item'
import { USER_ID, RESERVED_MAX_USER_ID, WALLET_RETRY_BEFORE_MS, WALLET_MAX_RETRIES } from '@/lib/constants'
import { timeUnitForRange, whenRange } from '@/lib/time'
import assertApiKeyNotPermitted from './apiKey'
import { hashEmail } from '@/lib/crypto'
import { isMuted } from '@/lib/user'
import { GqlAuthenticationError, GqlAuthorizationError, GqlInputError } from '@/lib/error'
import { processCrop } from '@/worker/imgproxy'
import { Prisma } from '@prisma/client'

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

export async function topUsers (parent, { cursor, when, by = 'stacked', from, to, limit }, { models, me }) {
  const decodedCursor = decodeCursor(cursor)
  const [fromDate, toDate] = whenRange(when, from, to || decodeCursor.time)
  const granularity = timeUnitForRange([fromDate, toDate]).toUpperCase()

  let column
  switch (by) {
    case 'stacked':
      column = Prisma.sql`stacked`; break
    case 'spent':
      column = Prisma.sql`spent`; break
    case 'items':
      column = Prisma.sql`items`; break
    default:
      throw new GqlInputError('invalid sort')
  }

  const users = (await models.$queryRaw`
    WITH user_outgoing AS (
      SELECT "AggPayIn"."userId", floor(sum("AggPayIn"."sumMcost") / 1000) as spent,
        sum("AggPayIn"."countGroup") as nitems
      FROM "AggPayIn"
      WHERE "AggPayIn"."timeBucket" >= ${fromDate}
      AND "AggPayIn"."timeBucket" <= ${toDate}
      AND "AggPayIn"."granularity" = ${granularity}::"AggGranularity"
      AND "AggPayIn"."slice" = 'USER_TOTAL'
      GROUP BY "AggPayIn"."userId"
    ),
    user_stats AS (
      SELECT "AggPayOut"."userId", COALESCE(user_outgoing."spent", 0) as spent,
        COALESCE(user_outgoing."nitems", 0) as nitems, floor(sum("AggPayOut"."sumMtokens") / 1000) as stacked
      FROM "AggPayOut"
      LEFT JOIN user_outgoing ON "AggPayOut"."userId" = user_outgoing."userId"
      WHERE "AggPayOut"."timeBucket" >= ${fromDate}
      AND "AggPayOut"."timeBucket" <= ${toDate}
      AND "AggPayOut"."granularity" = ${granularity}::"AggGranularity"
      AND "AggPayOut"."slice" = 'USER_TOTAL'
      GROUP BY "AggPayOut"."userId", user_outgoing."spent", user_outgoing."nitems"
    )
    SELECT * FROM user_stats
    JOIN users ON user_stats."userId" = users.id
    ORDER BY ${column} DESC NULLS LAST, users.created_at ASC
    OFFSET ${decodedCursor.offset}
    LIMIT ${limit}`
  ).map(
    u => u.hideFromTopUsers && (!me || me.id !== u.id) ? null : u
  )

  return {
    cursor: users.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
    users
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
        throw new GqlAuthenticationError()
      }

      return await models.user.findUnique({ where: { id: me.id } })
    },
    user: async (parent, { id, name }, { models }) => {
      if (id) id = Number(id)
      if (!id && !name) {
        throw new GqlInputError('id or name is required')
      }
      return await models.user.findUnique({ where: { id, name } })
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
        throw new GqlAuthenticationError()
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
        throw new GqlAuthenticationError()
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
        SELECT *
          FROM users
          WHERE streak IS NOT NULL
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
    userSuggestions: async (parent, { q, limit }, { models }) => {
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
          FROM "AggPayOut"
          JOIN users on users.id = "AggPayOut"."userId"
          WHERE NOT users."hideFromTopUsers"
          AND "AggPayOut"."slice" = 'USER_TOTAL'
          AND "AggPayOut"."granularity" = 'HOUR'
          AND "AggPayOut"."timeBucket" = (
            SELECT max("timeBucket")
            FROM "AggPayOut"
            WHERE "AggPayOut"."slice" = 'USER_TOTAL'
            AND "AggPayOut"."granularity" = 'HOUR'
          )
          ORDER BY "AggPayOut"."sumMtokens" DESC, users.created_at ASC
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
            '"Item"."deletedAt" IS NULL',
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
        const proxyPayment = await models.payIn.findFirst({
          where: {
            userId: me.id,
            payInState: 'PAID',
            payInStateChangedAt: {
              gt: lastChecked
            },
            payInType: 'PROXY_PAYMENT'
          }
        })
        if (proxyPayment) {
          foundNotes()
          return true
        }
      }

      if (user.noteWithdrawals) {
        const withdrawal = await models.payIn.findFirst({
          where: {
            userId: me.id,
            payInState: 'PAID',
            payInStateChangedAt: {
              gt: lastChecked
            },
            payInType: {
              in: ['WITHDRAWAL', 'AUTO_WITHDRAWAL']
            }
          }
        })
        if (withdrawal) {
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

      const [invoiceActionFailed] = await models.$queryRaw`
        SELECT EXISTS(
          SELECT *
          FROM "PayIn"
          WHERE "PayIn"."payInState" = 'FAILED'
          AND "PayIn"."payInType" IN ('ITEM_CREATE', 'ZAP', 'DOWN_ZAP', 'BOOST')
          AND "PayIn"."userId" = ${me.id}
          AND "PayIn"."successorId" IS NULL
          AND (
            (
              "PayIn"."payInFailureReason" = 'USER_CANCELLED'
              AND "PayIn"."payInStateChangedAt" > ${lastChecked}::timestamp
            )
            OR (
              "PayIn"."payInStateChangedAt" <= now() - ${`${WALLET_RETRY_BEFORE_MS} milliseconds`}::interval
              AND "PayIn"."payInStateChangedAt" + ${`${WALLET_RETRY_BEFORE_MS} milliseconds`}::interval > ${lastChecked}::timestamp
            )
            OR (
              (
                SELECT COUNT(*)
                FROM "PayIn" sibling
                WHERE "sibling"."genesisId" = "PayIn"."genesisId" OR "sibling"."id" = "PayIn"."genesisId"
              ) >= ${WALLET_MAX_RETRIES}
              AND "PayIn"."payInStateChangedAt" > ${lastChecked}::timestamp
            )
          )
        )`

      if (invoiceActionFailed.exists) {
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
        AND SIMILARITY(name, ${q}) > ${Number(similarity) || 0.1} ORDER BY SIMILARITY(name, ${q}) DESC LIMIT ${Number(limit)}`
    }
  },

  Mutation: {
    disableFreebies: async (parent, args, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      // disable freebies if it hasn't been set yet
      try {
        await models.user.update({
          where: { id: me.id, disableFreebies: null },
          data: { disableFreebies: true }
        })
      } catch (err) {
        // ignore 'record not found' errors
        if (err.code !== 'P2025') {
          throw err
        }
      }

      return true
    },
    setName: async (parent, data, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await validateSchema(userSchema, data, { models })

      try {
        await models.user.update({ where: { id: me.id }, data })
        return data.name
      } catch (error) {
        if (error.code === 'P2002') {
          throw new GqlInputError('name taken')
        }
        throw error
      }
    },
    setSettings: async (parent, { settings: { nostrRelays, ...data } }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await validateSchema(settingsSchema, { nostrRelays, ...data })

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
        throw new GqlAuthenticationError()
      }

      await models.user.update({ where: { id: me.id }, data: { upvotePopover, tipPopover } })

      return true
    },
    cropPhoto: async (parent, { photoId, cropData }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const croppedUrl = await processCrop({ photoId: Number(photoId), cropData })
      if (!croppedUrl) {
        throw new GqlInputError('can\'t crop photo')
      }

      return croppedUrl
    },
    setPhoto: async (parent, { photoId }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await models.user.update({
        where: { id: me.id },
        data: { photoId: Number(photoId) }
      })

      return Number(photoId)
    },
    upsertBio: async (parent, { text }, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await validateSchema(bioSchema, { text })

      const user = await models.user.findUnique({ where: { id: me.id } })

      if (user.bioId) {
        return await updateItem(parent, { id: user.bioId, bio: true, text, title: `@${user.name}'s bio` }, { me, models, lnd })
      } else {
        return await createItem(parent, { bio: true, text, title: `@${user.name}'s bio` }, { me, models, lnd })
      }
    },
    generateApiKey: async (parent, { id }, { models, me }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const user = await models.user.findUnique({ where: { id: me.id } })
      if (!user.apiKeyEnabled) {
        throw new GqlAuthorizationError('you are not allowed to generate api keys')
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
        throw new GqlAuthenticationError()
      }

      return await models.user.update({ where: { id: me.id }, data: { apiKeyHash: null } })
    },
    unlinkAuth: async (parent, { authType }, { models, me }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      assertApiKeyNotPermitted({ me })

      let user
      if (authType === 'twitter' || authType === 'github') {
        user = await models.user.findUnique({ where: { id: me.id } })
        const account = await models.account.findFirst({ where: { userId: me.id, provider: authType } })
        if (!account) {
          throw new GqlInputError('no such account')
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
        throw new GqlInputError('no such account')
      }

      return await authMethods(user, undefined, { models, me })
    },
    linkUnverifiedEmail: async (parent, { email }, { models, me }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      assertApiKeyNotPermitted({ me })

      await validateSchema(emailSchema, { email })

      try {
        await models.user.update({
          where: { id: me.id },
          data: { emailHash: hashEmail({ email }) }
        })
      } catch (error) {
        if (error.code === 'P2002') {
          throw new GqlInputError('email taken')
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
          throw new GqlInputError("you can't subscribe to a stacker that you've muted")
        }
        await models.userSubscription.update({ where: { followerId_followeeId: lookupData }, data: { postsSubscribedAt: existing.postsSubscribedAt ? null : new Date() } })
      } else {
        if (muted) {
          throw new GqlInputError("you can't subscribe to a stacker that you've muted")
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
          throw new GqlInputError("you can't subscribe to a stacker that you've muted")
        }
        await models.userSubscription.update({ where: { followerId_followeeId: lookupData }, data: { commentsSubscribedAt: existing.commentsSubscribedAt ? null : new Date() } })
      } else {
        if (muted) {
          throw new GqlInputError("you can't subscribe to a stacker that you've muted")
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
          throw new GqlInputError("you can't mute a stacker to whom you've subscribed")
        }
        await models.mute.create({ data: { ...lookupData } })
      }
      return { id }
    },
    hideWelcomeBanner: async (parent, data, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await models.user.update({ where: { id: me.id }, data: { hideWelcomeBanner: true } })
      return true
    },
    hideWalletRecvPrompt: async (parent, data, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await models.user.update({ where: { id: me.id }, data: { hideWalletRecvPrompt: true } })
      return true
    },
    setDiagnostics: async (parent, { diagnostics }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await models.user.update({ where: { id: me.id }, data: { diagnostics } })
      return diagnostics
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
          userId: user.id,
          itemPayIns: {
            some: {
              payIn: {
                payInState: 'PAID',
                payInType: 'ITEM_CREATE'
              }
            }
          }
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
          },
          itemPayIns: {
            some: {
              payIn: {
                payInState: 'PAID',
                payInType: 'ITEM_CREATE'
              }
            }
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
      return msatsToSats(user.msats + user.mcredits)
    },
    credits: async (user, args, { models, me }) => {
      if (!me || me.id !== user.id) {
        return 0
      }
      return msatsToSats(user.mcredits)
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
    },
    tipRandom: async (user, args, { me }) => {
      if (!me || me.id !== user.id) {
        return false
      }
      return !!user.tipRandomMin && !!user.tipRandomMax
    },
    hideWalletRecvPrompt: async (user, args, { models }) => {
      return user.hideWalletRecvPrompt || user.hasRecvWallet
    }
  },

  UserOptional: {
    streak: async (user, args, { models }) => {
      if (user.hideCowboyHat) {
        return null
      }

      return user.streak
    },
    hasSendWallet: async (user, args, { models }) => {
      if (user.hideCowboyHat) {
        return false
      }
      return user.hasSendWallet
    },
    hasRecvWallet: async (user, args, { models }) => {
      if (user.hideCowboyHat) {
        return false
      }
      return user.hasRecvWallet
    },
    maxStreak: async (user, args, { models }) => {
      if (user.hideCowboyHat) {
        return null
      }

      const [{ max }] = await models.$queryRaw`
        SELECT MAX(COALESCE("endedAt"::date, (now() AT TIME ZONE 'America/Chicago')::date) - "startedAt"::date)
        FROM "Streak" WHERE "userId" = ${user.id}
        AND type = 'COWBOY_HAT'`
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
        return ((user.stackedMsats && msatsToSats(user.stackedMsats)) || 0)
      }

      const [fromDate, toDate] = whenRange(when, from, to)
      const granularity = timeUnitForRange([fromDate, toDate]).toUpperCase()
      const [{ stacked }] = await models.$queryRaw`
        SELECT sum("AggPayOut"."sumMtokens") as stacked
        FROM "AggPayOut"
        WHERE "AggPayOut"."userId" = ${user.id}
        AND "AggPayOut"."timeBucket" >= ${fromDate}
        AND "AggPayOut"."timeBucket" <= ${toDate}
        AND "AggPayOut"."granularity" = ${granularity}::"AggGranularity"
        AND "AggPayOut"."slice" = 'USER_TOTAL'
        GROUP BY "AggPayOut"."userId"
      `
      return (stacked && msatsToSats(stacked)) || 0
    },
    spent: async (user, { when, from, to }, { models, me }) => {
      if ((!me || me.id !== user.id) && user.hideFromTopUsers) {
        return null
      }

      if (typeof user.spent !== 'undefined') {
        return user.spent
      }

      const [fromDate, toDate] = whenRange(when, from, to)
      const granularity = timeUnitForRange([fromDate, toDate]).toUpperCase()
      const [{ spent }] = await models.$queryRaw`
        SELECT sum("AggPayIn"."sumMcost") as spent
        FROM "AggPayIn"
        WHERE "AggPayIn"."userId" = ${user.id}
        AND "AggPayIn"."timeBucket" >= ${fromDate}
        AND "AggPayIn"."timeBucket" <= ${toDate}
        AND "AggPayIn"."granularity" = ${granularity}::"AggGranularity"
        AND "AggPayIn"."slice" = 'USER_TOTAL'
        GROUP BY "AggPayIn"."userId"
      `

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
