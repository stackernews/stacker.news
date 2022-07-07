const serialize = require('../api/resolvers/serial')

const ITEM_EACH_REWARD = 3.0
const UPVOTE_EACH_REWARD = 6.0
const TOP_ITEMS = 21
const EARLY_MULTIPLIER_MAX = 100.0

// TODO: use a weekly trust measure or make trust decay
function earn ({ models }) {
  return async function ({ name }) {
    console.log('running', name)

    // compute how much sn earned today
    const [{ sum }] = await models.$queryRaw`
        SELECT sum("ItemAct".sats)
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        WHERE ("ItemAct".act in ('BOOST', 'STREAM')
          OR ("ItemAct".act = 'VOTE' AND "Item"."userId" = "ItemAct"."userId"))
          AND "ItemAct".created_at > now_utc() - INTERVAL '1 day'`

    /*
      How earnings work:
      1/3: top 21 posts over last 36 hours, scored on a relative basis
      1/3: top 21 comments over last 36 hours, scored on a relative basis
      1/3: top upvoters of top posts/comments, scored on:
        - their trust
        - how much they tipped
        - how early they upvoted it
        - how the post/comment scored
    */

    // get earners { id, earnings }
    const earners = await models.$queryRaw(`
      WITH item_ratios AS (
        SELECT *,
            "weightedVotes"/(sum("weightedVotes") OVER (PARTITION BY "parentId" IS NULL)) AS ratio
        FROM (
            SELECT *,
                ROW_NUMBER() OVER (PARTITION BY "parentId" IS NULL ORDER BY "weightedVotes" desc) AS r
            FROM
                "Item"
            WHERE created_at >= now_utc() - interval '36 hours'
        ) x
        WHERE x.r <= ${TOP_ITEMS}
        ),
      upvoters AS (
          SELECT "ItemAct"."userId", item_ratios.id, item_ratios.ratio, item_ratios."parentId",
              sum("ItemAct".sats) as tipped, min("ItemAct".created_at) as acted_at
          FROM item_ratios
          JOIN "ItemAct" on "ItemAct"."itemId" = item_ratios.id
          WHERE act IN ('VOTE','TIP')
          AND "ItemAct"."userId" <> item_ratios."userId"
          GROUP BY "ItemAct"."userId", item_ratios.id, item_ratios.ratio, item_ratios."parentId"
      ),
      upvoter_ratios AS (
          SELECT "userId", sum(early_multiplier*tipped_ratio*ratio*users.trust) as upvoting_score,
              "parentId" IS NULL as "isPost"
          FROM (
              SELECT *,
                  ${EARLY_MULTIPLIER_MAX}/(ROW_NUMBER() OVER (partition by id order by acted_at asc)) AS early_multiplier,
                  tipped::float/(sum(tipped) OVER (partition by id)) tipped_ratio
              FROM upvoters
          ) u
          JOIN users on "userId" = users.id
          GROUP BY "userId", "parentId" IS NULL
      )
      SELECT "userId" as id, FLOOR(sum(proportion)*${sum}*1000) as earnings
      FROM (
          SELECT "userId",
            upvoting_score/(sum(upvoting_score) OVER (PARTITION BY "isPost"))/${UPVOTE_EACH_REWARD} as proportion
          FROM upvoter_ratios
          UNION ALL
          SELECT "userId", ratio/${ITEM_EACH_REWARD} as proportion
          FROM item_ratios
      ) a
      GROUP BY "userId"
      HAVING FLOOR(sum(proportion)*${sum}) >= 1`)

    // for each earner, serialize earnings
    // we do this for each earner because we don't need to serialize
    // all earner updates together
    earners.forEach(async earner => {
      if (earner.earnings > 0) {
        await serialize(models,
          models.$executeRaw`SELECT earn(${earner.id}, ${earner.earnings})`)
      }
    })

    console.log('done', name)
  }
}

module.exports = { earn }
