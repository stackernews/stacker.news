import { decodeCursor, LIMIT, nextNoteCursorEncoded } from '@/lib/cursor'
import { getItem, filterSql, whereSql, muteSql, activeOrMineSql, paidItemSql } from './item'
import { pushSubscriptionSchema, validateSchema } from '@/lib/validate'
import { sendPushSubscriptionReply } from '@/lib/webPush'
import { getSub } from './sub'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { getPayIn } from './payIn'
import { PAY_IN_NOTIFICATION_TYPES, WALLET_RETRY_BEFORE_MS, WALLET_MAX_RETRIES } from '@/lib/constants'
import { lexicalHTMLGenerator } from '@/lib/lexical/server/html'
import { Prisma } from '@prisma/client'
import { EXTERNAL_TRANSACTION_INCLUDE } from '@/wallets/server/external-transactions'

const PAY_IN_NOTIFICATION_TYPES_SQL = Prisma.join(
  PAY_IN_NOTIFICATION_TYPES.map(type => Prisma.sql`${type}::"PayInType"`)
)

export default {
  Query: {
    notifications: async (parent, { cursor, inc }, ctx) => {
      const { me, models, userLoader } = ctx
      const decodedCursor = decodeCursor(cursor)
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const meFull = await userLoader.load(me.id)

      /*
        So that we can cursor over results, we union notifications together ...
        this requires we have the same number of columns in all results

        select "Item".id, NULL as earnedSats, "Item".created_at as created_at from
        "Item" JOIN "Item" p ON "Item"."parentId" = p.id AND p."userId" = 622 AND
        "Item"."userId" <> 622 UNION ALL select "Item".id, "Vote".sats as earnedSats,
        "Vote".created_at as created_at FROM "Item" LEFT JOIN "Vote" on
        "Vote"."itemId" = "Item".id AND "Vote"."userId" <> 622 AND "Vote".boost = false
        WHERE "Item"."userId" = 622 ORDER BY created_at DESC;

        Because we want to "collapse" time adjacent votes in the result

        select vote.id, sum(vote."earnedSats") as "earnedSats", max(vote.voted_at)
        as "createdAt" from (select "Item".*, "Vote".sats as "earnedSats",
        "Vote".created_at as voted_at, ROW_NUMBER() OVER(ORDER BY "Vote".created_at) -
        ROW_NUMBER() OVER(PARTITION BY "Item".id ORDER BY "Vote".created_at) as island
        FROM "Item" LEFT JOIN "Vote" on "Vote"."itemId" = "Item".id AND
        "Vote"."userId" <> 622 AND "Vote".boost = false WHERE "Item"."userId" = 622)
        as vote group by vote.id, vote.island order by max(vote.voted_at) desc;

        We can also "collapse" votes occuring within 1 hour intervals of each other
        (I haven't yet combined with the above collapsing method .. but might be
        overkill)

        select "Item".id, sum("Vote".sats) as earnedSats, max("Vote".created_at)
        as created_at, ROW_NUMBER() OVER(ORDER BY max("Vote".created_at)) - ROW_NUMBER()
        OVER(PARTITION BY "Item".id ORDER BY max("Vote".created_at)) as island FROM
        "Item" LEFT JOIN "Vote" on "Vote"."itemId" = "Item".id AND "Vote"."userId" <> 622
        AND "Vote".boost = false WHERE "Item"."userId" = 622 group by "Item".id,
        date_trunc('hour', "Vote".created_at) order by created_at desc;

        island approach we used to take
        (SELECT ${ITEM_SUBQUERY_FIELDS}, max(subquery.voted_at) as "sortTime",
          sum(subquery.sats) as "earnedSats", false as mention
          FROM
          (SELECT ${ITEM_FIELDS}, "ItemAct".created_at as voted_at, "ItemAct".sats,
            ROW_NUMBER() OVER(ORDER BY "ItemAct".created_at) -
            ROW_NUMBER() OVER(PARTITION BY "Item".id ORDER BY "ItemAct".created_at) as island
            FROM "ItemAct"
            JOIN "Item" on "ItemAct"."itemId" = "Item".id
            WHERE "ItemAct"."userId" <> $1
            AND "ItemAct".created_at <= $2
            AND "ItemAct".act <> 'BOOST'
            AND "Item"."userId" = $1) subquery
          GROUP BY ${ITEM_SUBQUERY_FIELDS}, subquery.island
          ORDER BY max(subquery.voted_at) desc
          LIMIT ${LIMIT}+$3)
      */

      // HACK to make notifications faster, we only return a limited sub set of the unioned
      // queries ... we only ever need at most LIMIT+current offset in the child queries to
      // have enough items to return in the union

      const queries = []

      const itemDrivenQueries = []

      // Thread subscriptions
      itemDrivenQueries.push(
        Prisma.sql`SELECT "Item".*, "Item".created_at AS "sortTime", ${'Reply'}::TEXT AS type
          FROM "ThreadSubscription"
          JOIN "Reply" r ON "ThreadSubscription"."itemId" = r."ancestorId"
          JOIN "Item" ON r."itemId" = "Item".id
          ${whereSql(
            Prisma.sql`"ThreadSubscription"."userId" = ${me.id}::INTEGER`,
            Prisma.sql`r.created_at >= "ThreadSubscription".created_at`,
            Prisma.sql`r.created_at < ${decodedCursor.time}::TIMESTAMP`,
            Prisma.sql`r."userId" <> ${me.id}::INTEGER`,
            meFull.noteAllDescendants ? null : Prisma.sql`r.level = 1`
          )}
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}::INTEGER`
      )

      // User subscriptions
      // Only include posts or comments created after the corresponding subscription was enabled, not _all_ from history
      itemDrivenQueries.push(
        Prisma.sql`SELECT "Item".*, "Item".created_at AS "sortTime", ${'FollowActivity'}::TEXT AS type
          FROM "Item"
          JOIN "UserSubscription" ON "Item"."userId" = "UserSubscription"."followeeId"
          ${whereSql(
            Prisma.sql`"Item".created_at < ${decodedCursor.time}::TIMESTAMP`,
            Prisma.sql`"UserSubscription"."followerId" = ${me.id}::INTEGER`,
            Prisma.sql`(
              ("Item"."parentId" IS NULL AND "UserSubscription"."postsSubscribedAt" IS NOT NULL AND "Item".created_at >= "UserSubscription"."postsSubscribedAt")
              OR ("Item"."parentId" IS NOT NULL AND "UserSubscription"."commentsSubscribedAt" IS NOT NULL AND "Item".created_at >= "UserSubscription"."commentsSubscribedAt")
            )`
          )}
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}::INTEGER`
      )

      // Territory subscriptions
      // Gate the time-ordered item scan on a non-empty subscription set and
      // bound it to the oldest possible territory notification.
      itemDrivenQueries.push(
        Prisma.sql`SELECT "TerritoryItem".*, "TerritoryItem".created_at AS "sortTime", ${'TerritoryPost'}::TEXT AS type
          FROM (
            SELECT MIN(created_at) AS "oldestCreatedAt"
            FROM "SubSubscription"
            WHERE "userId" = ${me.id}::INTEGER
            HAVING COUNT(*) > 0
          ) "TerritorySubscriptionBounds"
          CROSS JOIN LATERAL (
            SELECT "Item".*
            FROM "Item"
            JOIN LATERAL (
              SELECT 1
              FROM "ItemSub"
              JOIN "SubSubscription"
                ON "SubSubscription"."userId" = ${me.id}::INTEGER
                AND "SubSubscription"."subName" = "ItemSub"."subName"
              WHERE "ItemSub"."itemId" = "Item".id
              AND "Item".created_at >= "SubSubscription".created_at
              LIMIT 1
            ) "SubscribedTerritory" ON true
            ${whereSql(
              Prisma.sql`"Item".created_at < ${decodedCursor.time}::TIMESTAMP`,
              Prisma.sql`"Item".created_at >= "TerritorySubscriptionBounds"."oldestCreatedAt"`,
              Prisma.sql`"Item"."userId" <> ${me.id}::INTEGER`,
              Prisma.sql`"Item"."parentId" IS NULL`
            )}
            ORDER BY "Item".created_at DESC
            LIMIT ${LIMIT}::INTEGER
          ) "TerritoryItem"`
      )

      // mentions
      if (meFull.noteMentions) {
        itemDrivenQueries.push(
          Prisma.sql`SELECT "Item".*, "Mention".created_at AS "sortTime", ${'Mention'}::TEXT AS type
            FROM "Mention"
            JOIN "Item" ON "Mention"."itemId" = "Item".id
            ${whereSql(
              Prisma.sql`"Item".created_at < ${decodedCursor.time}::TIMESTAMP`,
              Prisma.sql`"Mention"."userId" = ${me.id}::INTEGER`,
              Prisma.sql`"Item"."userId" <> ${me.id}::INTEGER`
            )}
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER`
        )
      }
      // item mentions
      if (meFull.noteItemMentions) {
        itemDrivenQueries.push(
          Prisma.sql`SELECT "Referrer".*, "ItemMention".created_at AS "sortTime", ${'ItemMention'}::TEXT AS type
            FROM "ItemMention"
            JOIN "Item" "Referrer" ON "ItemMention"."referrerId" = "Referrer".id
            ${whereSql(
              Prisma.sql`"ItemMention".created_at < ${decodedCursor.time}::TIMESTAMP`,
              Prisma.sql`"Referrer"."userId" <> ${me.id}::INTEGER`,
              Prisma.sql`"ItemMention"."refereeUserId" = ${me.id}::INTEGER`
            )}
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER`
        )
      }
      // Inner union to de-dupe item-driven notifications
      queries.push(
        // Only record per item ID
        Prisma.sql`(
          SELECT DISTINCT ON (id) "Item".id::TEXT, "Item"."sortTime", NULL::INTEGER AS "earnedSats", "Item".type
          FROM (
            ${Prisma.join(itemDrivenQueries.map(query => Prisma.sql`(${query})`), ' UNION ALL ')}
          ) as "Item"
          ${whereSql(
            Prisma.sql`"Item".created_at < ${decodedCursor.time}::TIMESTAMP`,
            Prisma.sql`"Item"."deletedAt" IS NULL`,
            paidItemSql(me),
            await filterSql(null, null, null, ctx),
            muteSql(me),
            activeOrMineSql(me))}
          ORDER BY id ASC, CASE
            WHEN type = 'Mention' THEN 1
            WHEN type = 'Reply' THEN 2
            WHEN type = 'FollowActivity' THEN 3
            WHEN type = 'TerritoryPost' THEN 4
            WHEN type = 'ItemMention' THEN 5
          END ASC
        )`
      )

      // territory transfers
      queries.push(
        Prisma.sql`(SELECT "TerritoryTransfer".id::text, "TerritoryTransfer"."created_at" AS "sortTime", NULL::INTEGER as "earnedSats",
          ${'TerritoryTransfer'}::TEXT AS type
          FROM "TerritoryTransfer"
          WHERE "TerritoryTransfer"."newUserId" = ${me.id}::INTEGER
          AND "TerritoryTransfer"."created_at" <= ${decodedCursor.time}::TIMESTAMP
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}::INTEGER)`
      )

      if (meFull.noteItemSats) {
        queries.push(
          Prisma.sql`(SELECT "Item".id::TEXT, "Item"."lastZapAt" AS "sortTime",
            ("Item".msats/1000)::INTEGER as "earnedSats", ${'Votification'}::TEXT AS type
            FROM "Item"
            WHERE "Item"."userId" = ${me.id}::INTEGER
            AND "Item"."lastZapAt" < ${decodedCursor.time}::TIMESTAMP
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER)`
        )
        queries.push(
          Prisma.sql`(SELECT "PayIn".id::text, "PayIn"."payInStateChangedAt" AS "sortTime",
            COALESCE(FLOOR("PayOutBolt11"."msats" / 1000), 0)::INTEGER as "earnedSats",
            ${'BountyPayment'}::TEXT AS type
            FROM "PayIn"
            JOIN "ItemPayIn" ON "ItemPayIn"."payInId" = "PayIn".id
            JOIN "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn".id
            WHERE "PayIn"."payInType" = 'BOUNTY_PAYMENT'
            AND "PayIn"."payInState" = 'PAID'
            AND "PayOutBolt11"."userId" = ${me.id}::INTEGER
            AND "PayIn"."payInStateChangedAt" < ${decodedCursor.time}::TIMESTAMP
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER)`
        )
      }

      if (meFull.noteForwardedSats) {
        queries.push(
          Prisma.sql`(SELECT "Item".id::TEXT, "Item"."lastZapAt" AS "sortTime",
            ("Item".msats / 1000 * "ItemForward".pct / 100)::INTEGER as "earnedSats", ${'ForwardedVotification'}::TEXT AS type
            FROM "Item"
            JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id AND "ItemForward"."userId" = ${me.id}::INTEGER
            WHERE "Item"."userId" <> ${me.id}::INTEGER
            AND "Item"."lastZapAt" < ${decodedCursor.time}::TIMESTAMP
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER)`
        )
      }

      if (meFull.noteDeposits) {
        // NOTE: for historical reasons we need to join the payInBolt11 table to make sure
        // the payInBolt11 record exists for the payIn
        queries.push(
          Prisma.sql`(SELECT "PayIn".id::text, "PayIn"."payInStateChangedAt" AS "sortTime",
              COALESCE(FLOOR("PayIn"."mcost" / 1000), 0)::INTEGER as "earnedSats",
            ${'PayInification'}::TEXT AS type
            FROM "PayIn"
            JOIN "PayInBolt11" ON "PayInBolt11"."payInId" = "PayIn".id
            WHERE "PayIn"."userId" = ${me.id}::INTEGER
            AND "PayIn"."payInState" = 'PAID'
            AND "PayIn"."payInStateChangedAt" < ${decodedCursor.time}::TIMESTAMP
            AND "PayIn"."mcost" > 1000
            AND "PayIn"."payInType" = 'PROXY_PAYMENT'
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER)`
        )
        queries.push(
          Prisma.sql`(SELECT "ExternalTransaction".id::text, "ExternalTransaction".updated_at AS "sortTime",
            COALESCE(FLOOR(COALESCE("ExternalTransaction"."settledMsats", "ExternalTransaction"."amountMsats") / 1000), 0)::INTEGER AS "earnedSats",
            ${'ExternalReceiveNotification'}::TEXT AS type
            FROM "ExternalTransaction"
            WHERE "ExternalTransaction"."userId" = ${me.id}::INTEGER
            AND "ExternalTransaction"."direction" = 'RECEIVE'
            AND "ExternalTransaction"."outcome" = 'SETTLED'
            AND "ExternalTransaction".updated_at < ${decodedCursor.time}::TIMESTAMP
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER)`
        )
      }

      if (meFull.noteWithdrawals) {
        queries.push(
          Prisma.sql`(SELECT "PayIn".id::text, "PayIn"."payInStateChangedAt" AS "sortTime",
            COALESCE(FLOOR("PayOutBolt11"."msats" / 1000), 0)::INTEGER as "earnedSats",
            ${'PayInification'}::TEXT AS type
            FROM "PayIn"
            JOIN "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn".id
            WHERE "PayIn"."userId" = ${me.id}::INTEGER
            AND "PayIn"."payInState" = 'PAID'
            AND "PayIn"."payInStateChangedAt" < ${decodedCursor.time}::TIMESTAMP
            AND "PayOutBolt11"."msats" > 1000
            AND "PayIn"."payInType" IN ('WITHDRAWAL', 'AUTO_WITHDRAWAL')
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER)`
        )
      }

      if (meFull.noteInvites) {
        queries.push(
          Prisma.sql`(SELECT "Invite".id, MAX(users.created_at) AS "sortTime", NULL::INTEGER as "earnedSats",
            ${'Invitification'}::TEXT AS type
            FROM users JOIN "Invite" on users."inviteId" = "Invite".id
            WHERE "Invite"."userId" = ${me.id}::INTEGER
            AND users.created_at < ${decodedCursor.time}::TIMESTAMP
            GROUP BY "Invite".id
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER)`
        )
        queries.push(
          Prisma.sql`(SELECT users.id::text, users.created_at AS "sortTime", NULL::INTEGER as "earnedSats",
            ${'Referral'}::TEXT AS type
            FROM users
            WHERE "users"."referrerId" = ${me.id}::INTEGER
            AND "inviteId" IS NULL
            AND users.created_at < ${decodedCursor.time}::TIMESTAMP
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER)`
        )
      }

      if (meFull.noteEarning) {
        queries.push(
          Prisma.sql`(SELECT min(id)::text, created_at AS "sortTime", FLOOR(sum(msats) / 1000)::INTEGER as "earnedSats",
          ${'Earn'}::TEXT AS type
          FROM "Earn"
          WHERE "userId" = ${me.id}::INTEGER
          AND created_at < ${decodedCursor.time}::TIMESTAMP
          AND (type IS NULL OR type NOT IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL'))
          GROUP BY "userId", created_at
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}::INTEGER)`
        )
        queries.push(
          Prisma.sql`(SELECT min(id)::text, created_at AS "sortTime", FLOOR(sum(msats) / 1000)::INTEGER as "earnedSats",
          ${'ReferralReward'}::TEXT AS type
          FROM "Earn"
          WHERE "userId" = ${me.id}::INTEGER
          AND created_at < ${decodedCursor.time}::TIMESTAMP
          AND type IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL')
          GROUP BY "userId", created_at
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}::INTEGER)`
        )
      }

      if (meFull.noteCowboyHat) {
        queries.push(
          Prisma.sql`(SELECT id::text, updated_at AS "sortTime", 0::INTEGER as "earnedSats", ${'CowboyHat'}::TEXT AS type
          FROM "Streak"
          WHERE "userId" = ${me.id}::INTEGER
          AND updated_at < ${decodedCursor.time}::TIMESTAMP
          AND type = 'COWBOY_HAT'
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}::INTEGER)`
        )
        for (const type of ['HORSE', 'GUN']) {
          const gqlType = type.charAt(0) + type.slice(1).toLowerCase()
          queries.push(
            Prisma.sql`(SELECT id::text, "startedAt" AS "sortTime", 0::INTEGER as "earnedSats", ${`New${gqlType}`}::TEXT AS type
            FROM "Streak"
            WHERE "userId" = ${me.id}::INTEGER
            AND updated_at < ${decodedCursor.time}::TIMESTAMP
            AND type = ${type}::"StreakType"
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER)`
          )
          queries.push(
            Prisma.sql`(SELECT id::text AS id, "endedAt" AS "sortTime", 0::INTEGER as "earnedSats", ${`Lost${gqlType}`}::TEXT AS type
            FROM "Streak"
            WHERE "userId" = ${me.id}::INTEGER
            AND updated_at < ${decodedCursor.time}::TIMESTAMP
            AND "endedAt" IS NOT NULL
            AND type = ${type}::"StreakType"
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}::INTEGER)`
          )
        }
      }

      queries.push(
        Prisma.sql`(SELECT "Sub".name::text, "Sub"."statusUpdatedAt" AS "sortTime", NULL::INTEGER as "earnedSats",
          ${'SubStatus'}::TEXT AS type
          FROM "Sub"
          WHERE "Sub"."userId" = ${me.id}::INTEGER
          AND "status" <> 'ACTIVE'
          AND "statusUpdatedAt" < ${decodedCursor.time}::TIMESTAMP
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}::INTEGER)`
      )

      queries.push(
        Prisma.sql`(SELECT "Reminder".id::text, "Reminder"."remindAt" AS "sortTime", NULL::INTEGER as "earnedSats", ${'Reminder'}::TEXT AS type
        FROM "Reminder"
        WHERE "Reminder"."userId" = ${me.id}::INTEGER
        AND "Reminder"."remindAt" < ${decodedCursor.time}::TIMESTAMP
        ORDER BY "sortTime" DESC
        LIMIT ${LIMIT}::INTEGER)`
      )

      // payIns whose most recent attempt failed, are retried enough times,
      // are too old, or were manually cancelled
      queries.push(
        Prisma.sql`(SELECT "PayIn".id::text,
          "PayIn"."payInStateChangedAt" AS "sortTime", 0::INTEGER as "earnedSats", ${'PayInification'}::TEXT AS type
          FROM "PayIn"
          WHERE "PayIn"."payInState" = 'FAILED'
          AND "PayIn"."payInType" IN (${PAY_IN_NOTIFICATION_TYPES_SQL})
          AND "PayIn"."userId" = ${me.id}::INTEGER
          AND "PayIn"."successorId" IS NULL
          AND "PayIn"."benefactorId" IS NULL
          AND "PayIn"."payInStateChangedAt" < ${decodedCursor.time}::TIMESTAMP
          AND (
            "PayIn"."payInFailureReason" = 'USER_CANCELLED'
            OR "PayIn"."payInStateChangedAt" <= now() - ${`${WALLET_RETRY_BEFORE_MS} milliseconds`}::interval
            OR "PayIn"."retryCount" >= ${WALLET_MAX_RETRIES}::INTEGER
          )
        ORDER BY "sortTime" DESC
        LIMIT ${LIMIT}::INTEGER)`
      )

      queries.push(
        Prisma.sql`(SELECT "NotificationBulletin".id::text, "NotificationBulletin"."created_at" AS "sortTime", NULL::INTEGER as "earnedSats", ${'Bulletinification'}::TEXT AS type
        FROM "NotificationBulletin"
        WHERE "NotificationBulletin"."created_at" < ${decodedCursor.time}::TIMESTAMP
        ORDER BY "sortTime" DESC
        LIMIT ${LIMIT}::INTEGER)`
      )

      const notifications = await models.$queryRaw(Prisma.sql`
        SELECT id, "sortTime", "earnedSats", type,
            "sortTime" AS "minSortTime"
        FROM
        (${Prisma.join(queries, ' UNION ALL ')}) u
        ORDER BY "sortTime" DESC
        LIMIT ${LIMIT}::INTEGER`)

      if (decodedCursor.offset === 0) {
        models.user.update({ where: { id: me.id }, data: { checkedNotesAt: new Date() } }).catch(console.error)
      }

      return {
        lastChecked: meFull.checkedNotesAt,
        cursor: notifications.length === LIMIT ? nextNoteCursorEncoded(decodedCursor, notifications) : null,
        notifications
      }
    }
  },
  Mutation: {
    savePushSubscription: async (parent, { endpoint, p256dh, auth, oldEndpoint }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await validateSchema(pushSubscriptionSchema, { endpoint, p256dh, auth })

      let dbPushSubscription
      if (oldEndpoint) {
        dbPushSubscription = await models.pushSubscription.update({
          data: { userId: me.id, endpoint, p256dh, auth }, where: { endpoint: oldEndpoint }
        })
        console.log(`[webPush] updated subscription of user ${me.id}: old=${oldEndpoint} new=${endpoint}`)
      } else {
        dbPushSubscription = await models.pushSubscription.create({
          data: { userId: me.id, endpoint, p256dh, auth }
        })
        console.log(`[webPush] created subscription for user ${me.id}: endpoint=${endpoint}`)
      }

      await sendPushSubscriptionReply(dbPushSubscription)

      return dbPushSubscription
    },
    deletePushSubscription: async (parent, { endpoint }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const subscription = await models.pushSubscription.findFirst({ where: { endpoint, userId: Number(me.id) } })
      if (!subscription) {
        throw new GqlInputError('endpoint not found')
      }
      const deletedSubscription = await models.pushSubscription.delete({ where: { id: subscription.id } })
      console.log(`[webPush] deleted subscription ${deletedSubscription.id} of user ${deletedSubscription.userId} due to client request`)

      return deletedSubscription
    }
  },
  Notification: {
    __resolveType: async (n, args, { models }) => n.type
  },
  Votification: {
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  BountyPayment: {
    item: async (n, args, { models, me }) => {
      const itemPayIn = await models.itemPayIn.findUnique({ where: { payInId: Number(n.id) } })
      return await getItem(n, { id: itemPayIn.itemId }, { models, me })
    }
  },
  ForwardedVotification: {
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  Reply: {
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  FollowActivity: {
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  TerritoryPost: {
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  Reminder: {
    item: async (n, args, { models, me }) => {
      const { itemId } = await models.reminder.findUnique({ where: { id: Number(n.id) } })
      return await getItem(n, { id: itemId }, { models, me })
    }
  },
  TerritoryTransfer: {
    sub: async (n, args, { models, me }) => {
      const [sub] = await models.$queryRaw`
        SELECT "Sub".*
        FROM "TerritoryTransfer"
        JOIN "Sub" ON "Sub"."name" = "TerritoryTransfer"."subName"
        WHERE "TerritoryTransfer"."id" = ${Number(n.id)}`

      return sub
    }
  },
  JobChanged: {
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  SubStatus: {
    sub: async (n, args, { models, me }) => getSub(n, { name: n.id }, { models, me })
  },
  ReferralSource: {
    __resolveType: async (n, args, { models }) => n.type
  },
  Referral: {
    source: async (n, args, { models, me }) => {
      // retrieve the referee landing record
      const referral = await models.oneDayReferral.findFirst({ where: { refereeId: Number(n.id), landing: true } })
      if (!referral) return null // if no landing record, it will return a generic referral

      // HACK this is needed because referral.typeId for territory referrals is the sub name,
      // but the sub name can change after the referral is created
      // TODO: make OneDayReferral polymorphism normalized (denormalizing with triggers)
      async function getSubOrNull (name) {
        const sub = await getSub(n, { name }, { models, me })
        return sub ? { ...sub, type: 'Sub' } : null
      }

      switch (referral.type) {
        case 'POST':
        case 'COMMENT': return { ...await getItem(n, { id: referral.typeId }, { models, me }), type: 'Item' }
        case 'PROFILE': return { ...await models.user.findUnique({ where: { id: Number(referral.typeId) }, select: { name: true } }), type: 'User' }
        case 'TERRITORY': return await getSubOrNull(referral.typeId)
        default: return null
      }
    }
  },
  Bulletinification: {
    bulletin: async (n, args, { models, lexicalStateLoader }) => {
      const bulletin = await models.notificationBulletin.findUnique({ where: { id: Number(n.id) } })
      if (!bulletin) {
        return null
      }
      let lexicalState = null
      let html = null
      try {
        if (bulletin.text) {
          lexicalState = await lexicalStateLoader.load({ text: bulletin.text })
          if (lexicalState) {
            html = await lexicalHTMLGenerator(lexicalState)
          }
        }
      } catch (error) {
        console.error('error generating HTML from Lexical State:', error)
        lexicalState = null
        html = null
      }

      return {
        title: bulletin.title,
        text: bulletin.text,
        lexicalState,
        html,
        iconType: bulletin.iconType
      }
    }
  },
  CowboyHat: {
    days: async (n, args, { models }) => {
      const res = await models.$queryRaw`
        SELECT "endedAt"::date - "startedAt"::date AS days
        FROM "Streak"
        WHERE id = ${Number(n.id)} AND "endedAt" IS NOT NULL
      `
      return res.length ? res[0].days : null
    }
  },
  Earn: {
    sources: async (n, args, { me, models }) => {
      const [sources] = await models.$queryRawUnsafe(`
        SELECT
        FLOOR(sum(msats) FILTER(WHERE type = 'POST') / 1000) AS posts,
        FLOOR(sum(msats) FILTER(WHERE type = 'COMMENT') / 1000) AS comments,
        FLOOR(sum(msats) FILTER(WHERE type = 'TIP_POST') / 1000) AS "tipPosts",
        FLOOR(sum(msats) FILTER(WHERE type = 'TIP_COMMENT') / 1000) AS "tipComments"
        FROM "Earn"
        WHERE "userId" = $1 AND created_at <= $2 AND created_at >= $3
      `, Number(me.id), new Date(n.sortTime), new Date(n.minSortTime))
      sources.posts ||= 0
      sources.comments ||= 0
      sources.tipPosts ||= 0
      sources.tipComments ||= 0
      if (sources.posts + sources.comments + sources.tipPosts + sources.tipComments > 0) {
        return sources
      }

      return null
    }
  },
  ReferralReward: {
    sources: async (n, args, { me, models }) => {
      const [sources] = await models.$queryRawUnsafe(`
        SELECT
        COALESCE(FLOOR(sum(msats) FILTER(WHERE type = 'FOREVER_REFERRAL') / 1000), 0) AS forever,
        COALESCE(FLOOR(sum(msats) FILTER(WHERE type = 'ONE_DAY_REFERRAL') / 1000), 0) AS "oneDay"
        FROM "Earn"
        WHERE "userId" = $1 AND created_at = $2
      `, Number(me.id), new Date(n.sortTime))
      if (sources.forever + sources.oneDay > 0) {
        return sources
      }

      return null
    }
  },
  Mention: {
    mention: async (n, args, { models }) => true,
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  ItemMention: {
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  PayInification: {
    payIn: async (n, args, { me, models }) => getPayIn(n, { id: Number(n.id) }, { me, models }),
    payInItem: async (n, args, { models, me }) => {
      const itemPayIn = await models.itemPayIn.findUnique({ where: { payInId: Number(n.id) } })
      if (!itemPayIn) {
        return null
      }
      return await getItem(n, { id: itemPayIn.itemId }, { models, me })
    }
  },
  ExternalReceiveNotification: {
    transaction: async (n, args, { me, models }) => {
      return await models.externalTransaction.findFirst({
        where: {
          id: Number(n.id),
          userId: me.id
        },
        include: EXTERNAL_TRANSACTION_INCLUDE
      })
    }
  },
  Invitification: {
    invite: async (n, args, { models }) => {
      return await models.invite.findUnique({
        where: {
          id: n.id
        }
      })
    }
  }
}

// const ITEM_SUBQUERY_FIELDS =
//   `subquery.id, subquery."createdAt", subquery."updatedAt", subquery.title, subquery.text,
//   subquery.url, subquery."userId", subquery."parentId", subquery.path`

// const ITEM_GROUP_FIELDS =
//   `"Item".id, "Item".created_at, "Item".updated_at, "Item".title,
//   "Item".text, "Item".url, "Item"."userId", "Item"."parentId", ltree2text("Item"."path")`

// const ITEM_FIELDS =
//   `"Item".id, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt", "Item".title,
//   "Item".text, "Item".url, "Item"."userId", "Item"."parentId", ltree2text("Item"."path") AS path`
