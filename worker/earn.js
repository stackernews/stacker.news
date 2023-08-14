const serialize = require('../api/resolvers/serial')
const { ANON_USER_ID } = require('../lib/constants')

// const ITEM_EACH_REWARD = 3.0
// const UPVOTE_EACH_REWARD = 6.0
const TOP_PERCENTILE = 21
const TOTAL_UPPER_BOUND_MSATS = 1000000000
const REDUCE_REWARDS = [616, 6030, 946, 4502]

function earn ({ models }) {
  return async function ({ name }) {
    console.log('running', name)

    // compute how much sn earned today
    const [{ sum: sumDecimal }] = await models.$queryRaw`
      SELECT coalesce(sum(msats), 0) as sum
      FROM (
        (SELECT ("ItemAct".msats - COALESCE("ReferralAct".msats, 0)) as msats
          FROM "ItemAct"
          LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = "ItemAct".id
          WHERE date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', (now() - interval '1 day') AT TIME ZONE 'America/Chicago') AND "ItemAct".act <> 'TIP')
          UNION ALL
        (SELECT sats * 1000 as msats
          FROM "Donation"
          WHERE date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', (now() - interval '1 day') AT TIME ZONE 'America/Chicago'))
          UNION ALL
        (SELECT "ItemAct".msats
            FROM "Item"
            JOIN "ItemAct" ON "ItemAct"."itemId" = "Item".id
            WHERE "Item"."userId" = ${ANON_USER_ID} AND "ItemAct".act = 'TIP' AND "Item"."fwdUserId" IS NULL
            AND date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', (now() - interval '1 day') AT TIME ZONE 'America/Chicago'))
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

    console.log(name, 'giving away', sum, 'msats')

    /*
      How earnings (used to) work:
      1/3: top 21% posts over last 36 hours, scored on a relative basis
      1/3: top 21% comments over last 36 hours, scored on a relative basis
      1/3: top upvoters of top posts/comments, scored on:
        - their trust
        - how much they tipped
        - how early they upvoted it
        - how the post/comment scored

      Now: 100% of earnings go to zappers of the top 21% of posts/comments
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
          SELECT "userId", sum(early_multiplier*tipped_ratio*ratio*CASE WHEN users.id = ANY (${REDUCE_REWARDS}) THEN 0.2 ELSE CEIL(users.trust*2)+1 END) as upvoter_ratio,
              "parentId" IS NULL as "isPost", CASE WHEN "parentId" IS NULL THEN 'TIP_POST' ELSE 'TIP_COMMENT' END as type
          FROM (
              SELECT *,
                  10.0/LN(ROW_NUMBER() OVER (partition by id order by acted_at asc) + EXP(1.0)) AS early_multiplier,
                  tipped::float/(sum(tipped) OVER (partition by id)) tipped_ratio
              FROM upvoters
          ) u
          JOIN users on "userId" = users.id
          GROUP BY "userId", "parentId" IS NULL
      )
      SELECT "userId", NULL as id, type, ROW_NUMBER() OVER (PARTITION BY "isPost" ORDER BY upvoter_ratio DESC) as rank,
          upvoter_ratio/(sum(upvoter_ratio) OVER (PARTITION BY "isPost"))/2 as proportion
      FROM upvoter_ratios
      WHERE upvoter_ratio > 0
      ORDER BY "isPost", rank ASC`

    // in order to group earnings for users we use the same createdAt time for
    // all earnings
    const now = new Date(new Date().getTime())

    // this is just a sanity check because it seems like a good idea
    let total = 0

    // for each earner, serialize earnings
    // we do this for each earner because we don't need to serialize
    // all earner updates together
    earners.forEach(async earner => {
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
      }
    })

    console.log('done', name)
  }
}

module.exports = { earn }
