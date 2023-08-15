import { GraphQLError } from 'graphql'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { getItem, filterClause } from './item'
import { getInvoice } from './wallet'
import { pushSubscriptionSchema, ssValidate } from '../../lib/validate'
import { replyToSubscription } from '../webPush'

export default {
  Query: {
    notifications: async (parent, { cursor, inc }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      const meFull = await models.user.findUnique({ where: { id: me.id } })

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

      queries.push(
        `(SELECT DISTINCT "Item".id::TEXT, "Item".created_at AS "sortTime", NULL::BIGINT as "earnedSats",
            'Reply' AS type
            FROM "Item"
            JOIN "Item" p ON ${meFull.noteAllDescendants ? '"Item".path <@ p.path' : '"Item"."parentId" = p.id'}
            WHERE p."userId" = $1 AND "Item"."userId" <> $1 AND "Item".created_at <= $2
            ${await filterClause(me, models)}
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}+$3)
          UNION DISTINCT
          (SELECT DISTINCT "Item".id::TEXT, "Item".created_at AS "sortTime", NULL::BIGINT as "earnedSats",
            'Reply' AS type
            FROM "ThreadSubscription"
            JOIN "Item" p ON "ThreadSubscription"."itemId" = p.id
            JOIN "Item" ON ${meFull.noteAllDescendants ? '"Item".path <@ p.path' : '"Item"."parentId" = p.id'}
            WHERE
              "ThreadSubscription"."userId" = $1
              AND "Item"."userId" <> $1 AND "Item".created_at <= $2
            ${await filterClause(me, models)}
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}+$3)`
      )

      if (meFull.noteMentions) {
        queries.push(
          `(SELECT "Item".id::TEXT, "Mention".created_at AS "sortTime", NULL as "earnedSats",
            'Mention' AS type
            FROM "Mention"
            JOIN "Item" ON "Mention"."itemId" = "Item".id
            LEFT JOIN "Item" p ON "Item"."parentId" = p.id
            WHERE "Mention"."userId" = $1
            AND "Mention".created_at <= $2
            AND "Item"."userId" <> $1
            AND (p."userId" IS NULL OR p."userId" <> $1)
            ${await filterClause(me, models)}
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}+$3)`
        )
      }

      queries.push(
        `(SELECT "Item".id::text, "Item"."statusUpdatedAt" AS "sortTime", NULL as "earnedSats",
          'JobChanged' AS type
          FROM "Item"
          WHERE "Item"."userId" = $1
          AND "maxBid" IS NOT NULL
          AND "statusUpdatedAt" <= $2 AND "statusUpdatedAt" <> created_at
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}+$3)`
      )

      if (meFull.noteItemSats) {
        queries.push(
          `(SELECT "Item".id::TEXT, MAX("ItemAct".created_at) AS "sortTime",
            MAX("Item".msats/1000) as "earnedSats", 'Votification' AS type
            FROM "Item"
            JOIN "ItemAct" ON "ItemAct"."itemId" = "Item".id
            WHERE "ItemAct"."userId" <> $1
            AND "ItemAct".created_at <= $2
            AND "ItemAct".act IN ('TIP', 'FEE')
            AND "Item"."userId" = $1
            GROUP BY "Item".id
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}+$3)`
        )
      }

      if (meFull.noteDeposits) {
        queries.push(
          `(SELECT "Invoice".id::text, "Invoice"."confirmedAt" AS "sortTime", FLOOR("msatsReceived" / 1000) as "earnedSats",
            'InvoicePaid' AS type
            FROM "Invoice"
            WHERE "Invoice"."userId" = $1
            AND "confirmedAt" IS NOT NULL
            AND created_at <= $2
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}+$3)`
        )
      }

      if (meFull.noteInvites) {
        queries.push(
          `(SELECT "Invite".id, MAX(users.created_at) AS "sortTime", NULL as "earnedSats",
            'Invitification' AS type
            FROM users JOIN "Invite" on users."inviteId" = "Invite".id
            WHERE "Invite"."userId" = $1
            AND users.created_at <= $2
            GROUP BY "Invite".id
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}+$3)`
        )
        queries.push(
          `(SELECT users.id::text, users.created_at AS "sortTime", NULL as "earnedSats",
            'Referral' AS type
            FROM users
            WHERE "users"."referrerId" = $1
            AND "inviteId" IS NULL
            AND users.created_at <= $2
            LIMIT ${LIMIT}+$3)`
        )
      }

      if (meFull.noteEarning) {
        queries.push(
          `SELECT min(id)::text, created_at AS "sortTime", FLOOR(sum(msats) / 1000) as "earnedSats",
          'Earn' AS type
          FROM "Earn"
          WHERE "userId" = $1
          AND created_at <= $2
          GROUP BY "userId", created_at`
        )
      }

      if (meFull.noteCowboyHat) {
        queries.push(
          `SELECT id::text, updated_at AS "sortTime", 0 as "earnedSats", 'Streak' AS type
          FROM "Streak"
          WHERE "userId" = $1
          AND updated_at <= $2`
        )
      }

      // we do all this crazy subquery stuff to make 'reward' islands
      const notifications = await models.$queryRawUnsafe(
        `SELECT MAX(id) AS id, MAX("sortTime") AS "sortTime", sum("earnedSats") AS "earnedSats", type,
            MIN("sortTime") AS "minSortTime"
        FROM
          (SELECT *,
          CASE
            WHEN type = 'Earn' THEN
              ROW_NUMBER() OVER(ORDER BY "sortTime" DESC) -
              ROW_NUMBER() OVER(PARTITION BY type = 'Earn' ORDER BY "sortTime" DESC)
            ELSE
              ROW_NUMBER() OVER(ORDER BY "sortTime" DESC)
          END as island
          FROM
          (${queries.join(' UNION ALL ')}) u
        ) sub
        GROUP BY type, island
        ORDER BY "sortTime" DESC
        OFFSET $3
        LIMIT ${LIMIT}`, me.id, decodedCursor.time, decodedCursor.offset)

      if (decodedCursor.offset === 0) {
        await models.user.update({ where: { id: me.id }, data: { checkedNotesAt: new Date() } })
      }

      return {
        lastChecked: meFull.checkedNotesAt,
        cursor: notifications.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        notifications
      }
    }
  },
  Mutation: {
    savePushSubscription: async (parent, { endpoint, p256dh, auth, oldEndpoint }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await ssValidate(pushSubscriptionSchema, { endpoint, p256dh, auth })

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

      await replyToSubscription(dbPushSubscription.id, { title: 'Stacker News notifications are now active' })

      return dbPushSubscription
    },
    deletePushSubscription: async (parent, { endpoint }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      const subscription = await models.pushSubscription.findFirst({ where: { endpoint, userId: Number(me.id) } })
      if (!subscription) {
        throw new GraphQLError('endpoint not found', { extensions: { code: 'BAD_INPUT' } })
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
  Reply: {
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  JobChanged: {
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  Streak: {
    days: async (n, args, { models }) => {
      const res = await models.$queryRaw`
        SELECT "endedAt" - "startedAt" AS days
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
  Mention: {
    mention: async (n, args, { models }) => true,
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  InvoicePaid: {
    invoice: async (n, args, { me, models }) => getInvoice(n, { id: n.id }, { me, models })
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
