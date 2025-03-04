import { decodeCursor, LIMIT, nextNoteCursorEncoded } from '@/lib/cursor'
import { getItem, filterClause, whereClause, muteClause, activeOrMine } from './item'
import { getInvoice, getWithdrawl } from './wallet'
import { pushSubscriptionSchema, validateSchema } from '@/lib/validate'
import { replyToSubscription } from '@/lib/webPush'
import { getSub } from './sub'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { WALLET_MAX_RETRIES, WALLET_RETRY_BEFORE_MS } from '@/lib/constants'

export default {
  Query: {
    notifications: async (parent, { cursor, inc }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      if (!me) {
        throw new GqlAuthenticationError()
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

      const itemDrivenQueries = []

      // Thread subscriptions
      itemDrivenQueries.push(
        `SELECT "Item".*, "Item".created_at AS "sortTime", 'Reply' AS type
          FROM "ThreadSubscription"
          JOIN "Reply" r ON "ThreadSubscription"."itemId" = r."ancestorId"
          JOIN "Item" ON r."itemId" = "Item".id
          ${whereClause(
            '"ThreadSubscription"."userId" = $1',
            'r.created_at >= "ThreadSubscription".created_at',
            'r.created_at < $2',
            'r."userId" <> $1',
            ...(meFull.noteAllDescendants ? [] : ['r.level = 1'])
          )}
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}`
      )

      // User subscriptions
      // Only include posts or comments created after the corresponding subscription was enabled, not _all_ from history
      itemDrivenQueries.push(
        `SELECT "Item".*, "Item".created_at AS "sortTime", 'FollowActivity' AS type
          FROM "Item"
          JOIN "UserSubscription" ON "Item"."userId" = "UserSubscription"."followeeId"
          ${whereClause(
            '"Item".created_at < $2',
            '"UserSubscription"."followerId" = $1',
            `(
              ("Item"."parentId" IS NULL AND "UserSubscription"."postsSubscribedAt" IS NOT NULL AND "Item".created_at >= "UserSubscription"."postsSubscribedAt")
              OR ("Item"."parentId" IS NOT NULL AND "UserSubscription"."commentsSubscribedAt" IS NOT NULL AND "Item".created_at >= "UserSubscription"."commentsSubscribedAt")
            )`
          )}
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}`
      )

      // Territory subscriptions
      itemDrivenQueries.push(
        `SELECT "Item".*, "Item".created_at AS "sortTime", 'TerritoryPost' AS type
          FROM "Item"
          JOIN "SubSubscription" ON "Item"."subName" = "SubSubscription"."subName"
          ${whereClause(
            '"Item".created_at < $2',
            '"SubSubscription"."userId" = $1',
            '"Item"."userId" <> $1',
            '"Item"."parentId" IS NULL',
            '"Item".created_at >= "SubSubscription".created_at'
          )}
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT}`
      )

      // mentions
      if (meFull.noteMentions) {
        itemDrivenQueries.push(
          `SELECT "Item".*, "Mention".created_at AS "sortTime", 'Mention' AS type
            FROM "Mention"
            JOIN "Item" ON "Mention"."itemId" = "Item".id
            ${whereClause(
              '"Item".created_at < $2',
              '"Mention"."userId" = $1',
              '"Item"."userId" <> $1'
            )}
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}`
        )
      }
      // item mentions
      if (meFull.noteItemMentions) {
        itemDrivenQueries.push(
          `SELECT "Referrer".*, "ItemMention".created_at AS "sortTime", 'ItemMention' AS type
            FROM "ItemMention"
            JOIN "Item" "Referee" ON "ItemMention"."refereeId" = "Referee".id
            JOIN "Item" "Referrer" ON "ItemMention"."referrerId" = "Referrer".id
            ${whereClause(
              '"ItemMention".created_at < $2',
              '"Referrer"."userId" <> $1',
              '"Referee"."userId" = $1'
            )}
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT}`
        )
      }
      // Inner union to de-dupe item-driven notifications
      queries.push(
        // Only record per item ID
        `(
          SELECT DISTINCT ON (id) "Item".id::TEXT, "Item"."sortTime", NULL::BIGINT AS "earnedSats", "Item".type
          FROM (
            ${itemDrivenQueries.map(q => `(${q})`).join(' UNION ALL ')}
          ) as "Item"
          ${whereClause(
            '"Item".created_at < $2',
            await filterClause(me, models),
            muteClause(me),
            activeOrMine(me))}
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
        `(SELECT "TerritoryTransfer".id::text, "TerritoryTransfer"."created_at" AS "sortTime", NULL as "earnedSats",
          'TerritoryTransfer' AS type
          FROM "TerritoryTransfer"
          WHERE "TerritoryTransfer"."newUserId" = $1
          AND "TerritoryTransfer"."created_at" <= $2
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT})`
      )

      if (meFull.noteItemSats) {
        queries.push(
          `(SELECT "Item".id::TEXT, "Item"."lastZapAt" AS "sortTime",
            "Item".msats/1000 as "earnedSats", 'Votification' AS type
            FROM "Item"
            WHERE "Item"."userId" = $1
            AND "Item"."lastZapAt" < $2
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT})`
        )
      }

      if (meFull.noteForwardedSats) {
        queries.push(
          `(SELECT "Item".id::TEXT, "Item"."lastZapAt" AS "sortTime",
            ("Item".msats / 1000 * "ItemForward".pct / 100) as "earnedSats", 'ForwardedVotification' AS type
            FROM "Item"
            JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id AND "ItemForward"."userId" = $1
            WHERE "Item"."userId" <> $1
            AND "Item"."lastZapAt" < $2
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT})`
        )
      }

      if (meFull.noteDeposits) {
        queries.push(
          `(SELECT "Invoice".id::text, "Invoice"."confirmedAt" AS "sortTime",
              FLOOR("Invoice"."msatsReceived" / 1000) as "earnedSats",
            'InvoicePaid' AS type
            FROM "Invoice"
            WHERE "Invoice"."userId" = $1
            AND "Invoice"."confirmedAt" IS NOT NULL
            AND "Invoice"."created_at" < $2
            AND (
              ("Invoice"."isHeld" IS NULL AND "Invoice"."actionType" IS NULL)
              OR (
                "Invoice"."actionType" = 'RECEIVE'
                AND "Invoice"."actionState" = 'PAID'
              )
            )
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT})`
        )
      }

      if (meFull.noteWithdrawals) {
        queries.push(
          `(SELECT "Withdrawl".id::text, MAX(COALESCE("Invoice"."confirmedAt", "Withdrawl".created_at)) AS "sortTime",
            FLOOR(MAX("Withdrawl"."msatsPaid" / 1000)) as "earnedSats",
            'WithdrawlPaid' AS type
            FROM "Withdrawl"
            LEFT JOIN "InvoiceForward" ON "InvoiceForward"."withdrawlId" = "Withdrawl".id
            LEFT JOIN "Invoice" ON "InvoiceForward"."invoiceId" = "Invoice".id
            WHERE "Withdrawl"."userId" = $1
            AND "Withdrawl".status = 'CONFIRMED'
            AND "Withdrawl".created_at < $2
            AND "InvoiceForward"."id" IS NULL
            GROUP BY "Withdrawl".id
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT})`
        )
      }

      if (meFull.noteInvites) {
        queries.push(
          `(SELECT "Invite".id, MAX(users.created_at) AS "sortTime", NULL as "earnedSats",
            'Invitification' AS type
            FROM users JOIN "Invite" on users."inviteId" = "Invite".id
            WHERE "Invite"."userId" = $1
            AND users.created_at < $2
            GROUP BY "Invite".id
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT})`
        )
        queries.push(
          `(SELECT users.id::text, users.created_at AS "sortTime", NULL as "earnedSats",
            'Referral' AS type
            FROM users
            WHERE "users"."referrerId" = $1
            AND "inviteId" IS NULL
            AND users.created_at < $2
            ORDER BY "sortTime" DESC
            LIMIT ${LIMIT})`
        )
      }

      if (meFull.noteEarning) {
        queries.push(
          `(SELECT min(id)::text, created_at AS "sortTime", FLOOR(sum(msats) / 1000) as "earnedSats",
          'Earn' AS type
          FROM "Earn"
          WHERE "userId" = $1
          AND created_at < $2
          AND (type IS NULL OR type NOT IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL'))
          GROUP BY "userId", created_at
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT})`
        )
        queries.push(
          `(SELECT min(id)::text, created_at AS "sortTime", FLOOR(sum(msats) / 1000) as "earnedSats",
          'Revenue' AS type
          FROM "SubAct"
          WHERE "userId" = $1
          AND type = 'REVENUE'
          AND created_at < $2
          GROUP BY "userId", "subName", created_at
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT})`
        )
        queries.push(
          `(SELECT min(id)::text, created_at AS "sortTime", FLOOR(sum(msats) / 1000) as "earnedSats",
          'ReferralReward' AS type
          FROM "Earn"
          WHERE "userId" = $1
          AND created_at < $2
          AND type IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL')
          GROUP BY "userId", created_at
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT})`
        )
      }

      if (meFull.noteCowboyHat) {
        queries.push(
          `(SELECT id::text, updated_at AS "sortTime", 0 as "earnedSats", 'Streak' AS type
          FROM "Streak"
          WHERE "userId" = $1
          AND updated_at < $2
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT})`
        )
      }

      queries.push(
        `(SELECT "Sub".name::text, "Sub"."statusUpdatedAt" AS "sortTime", NULL as "earnedSats",
          'SubStatus' AS type
          FROM "Sub"
          WHERE "Sub"."userId" = $1
          AND "status" <> 'ACTIVE'
          AND "statusUpdatedAt" < $2
          ORDER BY "sortTime" DESC
          LIMIT ${LIMIT})`
      )

      queries.push(
        `(SELECT "Reminder".id::text, "Reminder"."remindAt" AS "sortTime", NULL as "earnedSats", 'Reminder' AS type
        FROM "Reminder"
        WHERE "Reminder"."userId" = $1
        AND "Reminder"."remindAt" < $2
        ORDER BY "sortTime" DESC
        LIMIT ${LIMIT})`
      )

      queries.push(
        `(SELECT "Invoice".id::text,
          CASE
            WHEN
              "Invoice"."paymentAttempt" < ${WALLET_MAX_RETRIES}
              AND "Invoice"."userCancel" = false
              AND "Invoice"."cancelledAt" <= now() - interval '${`${WALLET_RETRY_BEFORE_MS} milliseconds`}'
            THEN "Invoice"."cancelledAt" + interval '${`${WALLET_RETRY_BEFORE_MS} milliseconds`}'
            ELSE "Invoice"."updated_at"
          END AS "sortTime", NULL as "earnedSats", 'Invoicification' AS type
        FROM "Invoice"
        WHERE "Invoice"."userId" = $1
        AND "Invoice"."updated_at" < $2
        AND "Invoice"."actionState" = 'FAILED'
        AND (
          -- this is the inverse of the filter for automated retries
          "Invoice"."paymentAttempt" >= ${WALLET_MAX_RETRIES}
          OR "Invoice"."userCancel" = true
          OR "Invoice"."cancelledAt" <= now() - interval '${`${WALLET_RETRY_BEFORE_MS} milliseconds`}'
        )
        AND (
          "Invoice"."actionType" = 'ITEM_CREATE' OR
          "Invoice"."actionType" = 'ZAP' OR
          "Invoice"."actionType" = 'DOWN_ZAP' OR
          "Invoice"."actionType" = 'POLL_VOTE' OR
          "Invoice"."actionType" = 'BOOST'
        )
        ORDER BY "sortTime" DESC
        LIMIT ${LIMIT})`
      )

      const notifications = await models.$queryRawUnsafe(
        `SELECT id, "sortTime", "earnedSats", type,
            "sortTime" AS "minSortTime"
        FROM
        (${queries.join(' UNION ALL ')}) u
        ORDER BY "sortTime" DESC
        LIMIT ${LIMIT}`, me.id, decodedCursor.time)

      if (decodedCursor.offset === 0) {
        await models.user.update({ where: { id: me.id }, data: { checkedNotesAt: new Date() } })
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

      await replyToSubscription(dbPushSubscription.id, { title: 'Stacker News notifications are now active' })

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
      const transfer = await models.territoryTransfer.findUnique({ where: { id: Number(n.id) }, include: { sub: true } })
      return transfer.sub
    }
  },
  JobChanged: {
    item: async (n, args, { models, me }) => getItem(n, { id: n.id }, { models, me })
  },
  SubStatus: {
    sub: async (n, args, { models, me }) => getSub(n, { name: n.id }, { models, me })
  },
  Revenue: {
    subName: async (n, args, { models }) => {
      const subAct = await models.subAct.findUnique({
        where: {
          id: Number(n.id)
        }
      })

      return subAct.subName
    }
  },
  ReferralSource: {
    __resolveType: async (n, args, { models }) => n.type
  },
  Referral: {
    source: async (n, args, { models, me }) => {
      // retrieve the referee landing record
      const referral = await models.oneDayReferral.findFirst({ where: { refereeId: Number(n.id), landing: true } })
      if (!referral) return null // if no landing record, it will return a generic referral

      switch (referral.type) {
        case 'POST':
        case 'COMMENT': return { ...await getItem(n, { id: referral.typeId }, { models, me }), type: 'Item' }
        case 'TERRITORY': return { ...await getSub(n, { name: referral.typeId }, { models, me }), type: 'Sub' }
        case 'PROFILE': return { ...await models.user.findUnique({ where: { id: Number(referral.typeId) }, select: { name: true } }), type: 'User' }
        default: return null
      }
    }
  },
  Streak: {
    days: async (n, args, { models }) => {
      const res = await models.$queryRaw`
        SELECT "endedAt" - "startedAt" AS days
        FROM "Streak"
        WHERE id = ${Number(n.id)} AND "endedAt" IS NOT NULL
      `

      return res.length ? res[0].days : null
    },
    type: async (n, args, { models }) => {
      const res = await models.$queryRaw`
        SELECT "type"
        FROM "Streak"
        WHERE id = ${Number(n.id)}
      `
      return res.length ? res[0].type : null
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
  InvoicePaid: {
    invoice: async (n, args, { me, models }) => getInvoice(n, { id: n.id }, { me, models })
  },
  Invoicification: {
    invoice: async (n, args, { me, models }) => getInvoice(n, { id: n.id }, { me, models })
  },
  WithdrawlPaid: {
    withdrawl: async (n, args, { me, models }) => getWithdrawl(n, { id: n.id }, { me, models })
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
