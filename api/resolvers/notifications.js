import { AuthenticationError } from 'apollo-server-micro'
import { decodeCursor, LIMIT, nextCursorEncoded } from './cursor'

export default {
  Query: {
    notifications: async (parent, { cursor }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

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
      */

      let notifications = await models.$queryRaw(`
        SELECT ${ITEM_FIELDS}, "Item".created_at as "sortTime", NULL as "earnedSats",
        false as mention
        From "Item"
        JOIN "Item" p ON "Item"."parentId" = p.id
        WHERE p."userId" = $1
        AND "Item"."userId" <> $1 AND "Item".created_at <= $2
        UNION ALL
        (SELECT ${ITEM_SUBQUERY_FIELDS}, max(subquery.voted_at) as "sortTime",
        sum(subquery.sats) as "earnedSats", false as mention
        FROM
        (SELECT ${ITEM_FIELDS}, "Vote".created_at as voted_at, "Vote".sats,
        ROW_NUMBER() OVER(ORDER BY "Vote".created_at) -
        ROW_NUMBER() OVER(PARTITION BY "Item".id ORDER BY "Vote".created_at) as island
        FROM "Vote"
        JOIN "Item" on "Vote"."itemId" = "Item".id
        WHERE "Vote"."userId" <> $1
        AND "Vote".created_at <= $2
        AND "Vote".boost = false
        AND "Item"."userId" = $1) subquery
        GROUP BY ${ITEM_SUBQUERY_FIELDS}, subquery.island ORDER BY max(subquery.voted_at) desc)
        UNION ALL
        (SELECT ${ITEM_FIELDS}, "Mention".created_at as "sortTime",  NULL as "earnedSats",
        true as mention
        FROM "Mention"
        JOIN "Item" on "Mention"."itemId" = "Item".id
        JOIN "Item" p on "Item"."parentId" = p.id
        WHERE "Mention"."userId" = $1
        AND "Mention".created_at <= $2
        AND "Item"."userId" <> $1
        AND p."userId" <> $1)
        ORDER BY "sortTime" DESC
        OFFSET $3
        LIMIT ${LIMIT}`, me.id, decodedCursor.time, decodedCursor.offset)

      notifications = notifications.map(n => {
        n.item = { ...n }
        return n
      })

      const { checkedNotesAt } = await models.user.findUnique({ where: { id: me.id } })
      await models.user.update({ where: { id: me.id }, data: { checkedNotesAt: new Date() } })

      return {
        lastChecked: checkedNotesAt,
        cursor: notifications.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        notifications
      }
    }
  },
  Notification: {
    __resolveType: async (notification, args, { models }) =>
      notification.earnedSats ? 'Votification' : (notification.mention ? 'Mention' : 'Reply')
  }
}

const ITEM_SUBQUERY_FIELDS =
  `subquery.id, subquery."createdAt", subquery."updatedAt", subquery.title, subquery.text,
  subquery.url, subquery."userId", subquery."parentId", subquery.path`

const ITEM_FIELDS =
  `"Item".id, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt", "Item".title,
  "Item".text, "Item".url, "Item"."userId", "Item"."parentId", ltree2text("Item"."path") AS path`
