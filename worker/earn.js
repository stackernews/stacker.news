const serialize = require('../api/resolvers/serial')

// const ITEM_EACH_REWARD = 3.0
// const UPVOTE_EACH_REWARD = 6.0
const TOP_PERCENTILE = 21

function earn ({ models }) {
  return async function ({ name }) {
    console.log('running', name)

    // compute how much sn earned today
    const [{ sum: actSum }] = await models.$queryRaw`
        SELECT coalesce(sum("ItemAct".msats - coalesce("ReferralAct".msats, 0)), 0) as sum
        FROM "ItemAct"
        JOIN "Item" ON "ItemAct"."itemId" = "Item".id
        LEFT JOIN "ReferralAct" ON "ItemAct".id = "ReferralAct"."itemActId"
        WHERE "ItemAct".act <> 'TIP'
          AND "ItemAct".created_at > now_utc() - INTERVAL '1 day'`

    const [{ sum: donatedSum }] = await models.$queryRaw`
      SELECT coalesce(sum(sats), 0) as sum
      FROM "Donation"
      WHERE created_at > now_utc() - INTERVAL '1 day'`

    // XXX prisma returns wonky types from raw queries ... so be extra
    // careful with them
    const sum = Number(actSum) + (Number(donatedSum) * 1000)

    if (sum <= 0) {
      console.log('done', name, 'no sats to award today')
      return
    }

    // extra sanity check on rewards ... if it more than 1m sats, we
    // probably have a bug somewhere
    if (sum > 1000000000) {
      console.log('done', name, 'error: too many sats to award today')
      return
    }

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
    const earners = await models.$queryRawUnsafe(`
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
      upvoters AS (
          SELECT "ItemAct"."userId", item_ratios.id, item_ratios.ratio, item_ratios."parentId",
              sum("ItemAct".msats) as tipped, min("ItemAct".created_at) as acted_at
          FROM item_ratios
          JOIN "ItemAct" on "ItemAct"."itemId" = item_ratios.id
          WHERE act = 'TIP'
          GROUP BY "ItemAct"."userId", item_ratios.id, item_ratios.ratio, item_ratios."parentId"
      ),
      upvoter_ratios AS (
          SELECT "userId", sum(early_multiplier*tipped_ratio*ratio*users.trust) as upvoter_ratio,
              "parentId" IS NULL as "isPost", CASE WHEN "parentId" IS NULL THEN 'TIP_POST' ELSE 'TIP_COMMENT' END as type
          FROM (
              SELECT *,
                  1/(ROW_NUMBER() OVER (partition by id order by acted_at asc)) AS early_multiplier,
                  tipped::float/(sum(tipped) OVER (partition by id)) tipped_ratio
              FROM upvoters
          ) u
          JOIN users on "userId" = users.id
          GROUP BY "userId", "parentId" IS NULL
      )
      SELECT "userId", NULL as id, type, ROW_NUMBER() OVER (PARTITION BY "isPost" ORDER BY upvoter_ratio DESC) as rank,
          upvoter_ratio/(sum(upvoter_ratio) OVER (PARTITION BY "isPost"))/2 as proportion
      FROM upvoter_ratios
      WHERE upvoter_ratio > 0`)

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

      console.log('stacker', earner.userId, 'earned', earnings)

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
