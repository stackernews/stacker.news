import serialize from '../api/resolvers/serial.js'
import { sendUserNotification } from '../api/webPush/index.js'
import { ANON_USER_ID, SN_USER_IDS } from '../lib/constants.js'
import { msatsToSats, numWithUnits } from '../lib/format.js'

const ITEM_EACH_REWARD = 4.0
const UPVOTE_EACH_REWARD = 4.0
const TOP_PERCENTILE = 33
const TOTAL_UPPER_BOUND_MSATS = 1000000000

export async function earn ({ name, models }) {
  // rewards are calculated sitewide still
  // however for user gen subs currently only 50% of their fees go to rewards
  // the other 50% goes to the founder of the sub

  // compute how much sn earned today
  const [{ sum: sumDecimal }] = await models.$queryRaw`
      SELECT coalesce(sum(msats), 0) as sum
      FROM (
        (SELECT ("ItemAct".msats - COALESCE("ReferralAct".msats, 0)) * COALESCE("Sub"."rewardsPct", 100) * 0.01  as msats
          FROM "ItemAct"
          JOIN "Item" ON "Item"."id" = "ItemAct"."itemId"
          LEFT JOIN "Sub" ON "Sub"."name" = "Item"."subName"
          LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = "ItemAct".id
          WHERE date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', (now() - interval '1 day') AT TIME ZONE 'America/Chicago')
            AND "ItemAct".act <> 'TIP')
          UNION ALL
        (SELECT sats * 1000 as msats
          FROM "Donation"
          WHERE date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', (now() - interval '1 day') AT TIME ZONE 'America/Chicago'))
          UNION ALL
        -- any earnings from anon's stack that are not forwarded to other users
        (SELECT "ItemAct".msats
          FROM "Item"
          JOIN "ItemAct" ON "ItemAct"."itemId" = "Item".id
          LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id
          WHERE "Item"."userId" = ${ANON_USER_ID} AND "ItemAct".act = 'TIP'
          AND date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', (now() - interval '1 day') AT TIME ZONE 'America/Chicago')
          GROUP BY "ItemAct".id, "ItemAct".msats
          HAVING COUNT("ItemForward".id) = 0)
      ) subquery`

  // XXX primsa will return a Decimal (https://mikemcl.github.io/decimal.js)
  // because sum of a BIGINT returns a NUMERIC type (https://www.postgresql.org/docs/13/functions-aggregate.html)
  // and Decimal is what prisma maps it to https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#raw-query-type-mapping
  // so check it before coercing to Number
  if (!sumDecimal || sumDecimal.lessThanOrEqualTo(0)) {
    console.log('done', name, 'no sats to award today')
    return
  }

  // extra sanity check on rewards ... if it's more than upper bound, we
  // probably have a bug somewhere or we've grown A LOT
  if (sumDecimal.greaterThan(TOTAL_UPPER_BOUND_MSATS)) {
    console.log('done', name, 'error: too many sats to award today', sumDecimal)
    return
  }

  const sum = Number(sumDecimal)
  const heads = Math.random() < 0.5
  // if this category is selected, double its proportion
  // if it isn't select, zero its proportion
  const itemRewardMult = heads ? 0 : 2.0
  const upvoteRewardMult = heads ? 2.0 : 0

  console.log(name, 'giving away', sum, 'msats', 'rewarding', heads ? 'items' : 'upvotes')

  /*
      How earnings (used to) work:
      1/3: top 21% posts over last 36 hours, scored on a relative basis
      1/3: top 21% comments over last 36 hours, scored on a relative basis
      1/3: top upvoters of top posts/comments, scored on:
        - their trust
        - how much they tipped
        - how early they upvoted it
        - how the post/comment scored

      Now: 100% of earnings go to either top 33% of comments/posts or top 33% of upvoters
    */

  // get earners { userId, id, type, rank, proportion }
  const earners = await models.$queryRaw`
      -- get top 21% of posts and comments
      WITH item_ratios AS (
          SELECT *,
              CASE WHEN "parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type,
              CASE WHEN "weightedVotes" > 0 THEN "weightedVotes"/(sum("weightedVotes") OVER (PARTITION BY "parentId" IS NULL)) ELSE 0 END AS ratio
          FROM (
              SELECT *,
                  NTILE(100)  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS percentile,
                  ROW_NUMBER()  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS rank
              FROM
                  "Item"
              WHERE created_at >= now_utc() - interval '36 hours'
              AND "weightedVotes" > 0 AND "deletedAt" IS NULL AND NOT bio
          ) x
          WHERE x.percentile <= ${TOP_PERCENTILE}
      ),
      -- get top upvoters of top posts and comments
      upvoter_islands AS (
            SELECT "ItemAct"."userId", item_ratios.id, item_ratios.ratio, item_ratios."parentId",
                "ItemAct".msats as tipped, "ItemAct".created_at as acted_at,
                ROW_NUMBER() OVER (partition by item_ratios.id order by "ItemAct".created_at asc)
                - ROW_NUMBER() OVER (partition by item_ratios.id, "ItemAct"."userId" order by "ItemAct".created_at asc) AS island
            FROM item_ratios
            JOIN "ItemAct" on "ItemAct"."itemId" = item_ratios.id
            WHERE act = 'TIP'
      ),
      -- isolate contiguous upzaps from the same user on the same item so that when we take the log
      -- of the upzaps it accounts for successive zaps and does not disproporionately reward them
      upvoters AS (
        SELECT "userId", id, ratio, "parentId", GREATEST(log(sum(tipped) / 1000), 0) as tipped, min(acted_at) as acted_at
        FROM upvoter_islands
        GROUP BY "userId", id, ratio, "parentId", island
      ),
      -- the relative contribution of each upvoter to the post/comment
      -- early multiplier: 10/ln(early_rank + e)
      -- we also weight by trust in a step wise fashion
      upvoter_ratios AS (
          SELECT "userId", sum(early_multiplier*tipped_ratio*ratio*CASE WHEN users.id = ANY (${SN_USER_IDS}) THEN 0.2 ELSE CEIL(users.trust*2)+1 END) as upvoter_ratio,
              "parentId" IS NULL as "isPost", CASE WHEN "parentId" IS NULL THEN 'TIP_POST' ELSE 'TIP_COMMENT' END as type
          FROM (
              SELECT *,
                  10.0/LN(ROW_NUMBER() OVER (partition by id order by acted_at asc) + EXP(1.0)) AS early_multiplier,
                  tipped::float/(sum(tipped) OVER (partition by id)) tipped_ratio
              FROM upvoters
          ) u
          JOIN users on "userId" = users.id
          GROUP BY "userId", "parentId" IS NULL
      ),
      proportions AS (
        SELECT "userId", NULL as id, type, ROW_NUMBER() OVER (PARTITION BY "isPost" ORDER BY upvoter_ratio DESC) as rank,
            ${itemRewardMult}*upvoter_ratio/(sum(upvoter_ratio) OVER (PARTITION BY "isPost"))/${UPVOTE_EACH_REWARD} as proportion
        FROM upvoter_ratios
        WHERE upvoter_ratio > 0
        UNION ALL
        SELECT "userId", id, type, rank, ${upvoteRewardMult}*ratio/${ITEM_EACH_REWARD} as proportion
        FROM item_ratios)
      SELECT "userId", id, type, rank, proportion
      FROM proportions
      WHERE proportion > 0.000001`

  // in order to group earnings for users we use the same createdAt time for
  // all earnings
  const now = new Date(new Date().getTime())

  // this is just a sanity check because it seems like a good idea
  let total = 0

  const notifications = {}
  for (const earner of earners) {
    const earnings = Math.floor(parseFloat(earner.proportion) * sum)
    total += earnings
    if (total > sum) {
      console.log(name, 'total exceeds sum', total, '>', sum)
      return
    }

    console.log('stacker', earner.userId, 'earned', earnings, 'proportion', earner.proportion, 'rank', earner.rank, 'type', earner.type)

    if (earnings > 0) {
      await serialize(models,
        models.$executeRaw`SELECT earn(${earner.userId}::INTEGER, ${earnings},
          ${now}::timestamp without time zone, ${earner.type}::"EarnType", ${earner.id}::INTEGER, ${earner.rank}::INTEGER)`)

      const userN = notifications[earner.userId] || {}

      // sum total
      const prevMsats = userN.msats || 0
      const msats = earnings + prevMsats

      // sum total per earn type (POST, COMMENT, TIP_COMMENT, TIP_POST)
      const prevEarnTypeMsats = userN[earner.type]?.msats || 0
      const earnTypeMsats = earnings + prevEarnTypeMsats

      // best (=lowest) rank per earn type
      const prevEarnTypeBestRank = userN[earner.type]?.bestRank
      const earnTypeBestRank = prevEarnTypeBestRank ? Math.min(prevEarnTypeBestRank, Number(earner.rank)) : Number(earner.rank)

      notifications[earner.userId] = {
        ...userN,
        msats,
        [earner.type]: { msats: earnTypeMsats, bestRank: earnTypeBestRank }
      }
    }
  }

  await territoryRevenue({ models })

  Promise.allSettled(Object.entries(notifications).map(([userId, earnings]) =>
    sendUserNotification(parseInt(userId, 10), buildUserNotification(earnings))
  )).catch(console.error)
}

async function territoryRevenue ({ models }) {
  await serialize(models,
    models.$executeRaw`
      WITH revenue AS (
        SELECT coalesce(sum(msats), 0) as revenue, "subName", "userId"
        FROM (
          SELECT ("ItemAct".msats - COALESCE("ReferralAct".msats, 0)) * (1 - (COALESCE("Sub"."rewardsPct", 100) * 0.01)) as msats,
            "Sub"."name" as "subName", "Sub"."userId" as "userId"
            FROM "ItemAct"
            JOIN "Item" ON "Item"."id" = "ItemAct"."itemId"
            JOIN "Sub" ON "Sub"."name" = "Item"."subName"
            LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = "ItemAct".id
            WHERE date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', (now() - interval '1 day') AT TIME ZONE 'America/Chicago')
              AND "ItemAct".act <> 'TIP'
              AND "Sub".status <> 'STOPPED'
        ) subquery
        GROUP BY "subName", "userId"
      ),
      "SubActResult" AS (
        INSERT INTO "SubAct" (msats, "subName", "userId", type)
        SELECT revenue, "subName", "userId", 'REVENUE'
        FROM revenue
        WHERE revenue > 1000
        RETURNING *
      )
      UPDATE users SET msats = users.msats + "SubActResult".msats
      FROM "SubActResult"
      WHERE users.id = "SubActResult"."userId"`
  )
}

function buildUserNotification (earnings) {
  const fmt = msats => numWithUnits(msatsToSats(msats, { abbreviate: false }))

  const title = `you stacked ${fmt(earnings.msats)} in rewards`
  const tag = 'EARN'
  let body = ''
  if (earnings.POST) body += `#${earnings.POST.bestRank} among posts with ${fmt(earnings.POST.msats)} in total\n`
  if (earnings.COMMENT) body += `#${earnings.COMMENT.bestRank} among comments with ${fmt(earnings.COMMENT.msats)} in total\n`
  if (earnings.TIP_POST) body += `#${earnings.TIP_POST.bestRank} in post zapping with ${fmt(earnings.TIP_POST.msats)} in total\n`
  if (earnings.TIP_COMMENT) body += `#${earnings.TIP_COMMENT.bestRank} in comment zapping with ${fmt(earnings.TIP_COMMENT.msats)} in total`

  return { title, tag, body }
}
