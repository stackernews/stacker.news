const { LIMIT, decodeCursor, nextCursorEncoded } = require('../../lib/cursor')
const lnpr = require('bolt11')
const { GraphQLError } = require('graphql')
const { msatsToSatsDecimal } = require('../../lib/format')
const { SELECT } = require('./item-common')

exports.walletHistory = async (parent, { cursor, inc, limit = LIMIT }, { me, models, lnd }) => {
  const decodedCursor = decodeCursor(cursor)
  if (!me) {
    throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
  }

  const include = new Set(inc?.split(','))
  const queries = []

  if (include.has('invoice')) {
    queries.push(
      `(SELECT ('invoice' || id) as id, id as "factId", bolt11, created_at as "createdAt",
      COALESCE("msatsReceived", "msatsRequested") as msats, NULL as "msatsFee",
      CASE WHEN "confirmedAt" IS NOT NULL THEN 'CONFIRMED'
          WHEN "expiresAt" <= $2 THEN 'EXPIRED'
          WHEN cancelled THEN 'CANCELLED'
          ELSE 'PENDING' END as status,
      'invoice' as type
      FROM "Invoice"
      WHERE "userId" = $1
        AND created_at <= $2)`)
  }

  if (include.has('withdrawal')) {
    queries.push(
      `(SELECT ('withdrawal' || id) as id, id as "factId", bolt11, created_at as "createdAt",
      CASE WHEN status = 'CONFIRMED' THEN "msatsPaid"
      ELSE "msatsPaying" END as msats,
      CASE WHEN status = 'CONFIRMED' THEN "msatsFeePaid"
      ELSE "msatsFeePaying" END as "msatsFee",
      COALESCE(status::text, 'PENDING') as status,
      'withdrawal' as type
      FROM "Withdrawl"
      WHERE "userId" = $1
        AND created_at <= $2)`)
  }

  if (include.has('stacked')) {
    // query1 - get all sats stacked as OP or as a forward
    queries.push(
      `(SELECT
        ('stacked' || "Item".id) AS id,
        "Item".id AS "factId",
        NULL AS bolt11,
        MAX("ItemAct".created_at) AS "createdAt",
        FLOOR(
          SUM("ItemAct".msats)
          * (CASE WHEN "Item"."userId" = $1 THEN
              COALESCE(1 - ((SELECT SUM(pct) FROM "ItemForward" WHERE "itemId" = "Item".id) / 100.0), 1)
            ELSE
              (SELECT pct FROM "ItemForward" WHERE "itemId" = "Item".id AND "userId" = $1) / 100.0
            END)
        ) AS "msats",
        0 AS "msatsFee",
        NULL AS status,
        'stacked' AS type
      FROM "ItemAct"
      JOIN "Item" ON "ItemAct"."itemId" = "Item".id
      -- only join to with item forward for items where we aren't the OP
      LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id AND "Item"."userId" <> $1
      WHERE "ItemAct".act = 'TIP'
      AND ("Item"."userId" = $1 OR "ItemForward"."userId" = $1)
      AND "ItemAct".created_at <= $2
      GROUP BY "Item".id)`
    )
    queries.push(
        `(SELECT ('earn' || min("Earn".id)) as id, min("Earn".id) as "factId", NULL as bolt11,
        created_at as "createdAt", sum(msats),
        0 as "msatsFee", NULL as status, 'earn' as type
        FROM "Earn"
        WHERE "Earn"."userId" = $1 AND "Earn".created_at <= $2
        GROUP BY "userId", created_at)`)
    queries.push(
        `(SELECT ('referral' || "ReferralAct".id) as id, "ReferralAct".id as "factId", NULL as bolt11,
        created_at as "createdAt", msats,
        0 as "msatsFee", NULL as status, 'referral' as type
        FROM "ReferralAct"
        WHERE "ReferralAct"."referrerId" = $1 AND "ReferralAct".created_at <= $2)`)
  }

  if (include.has('spent')) {
    queries.push(
      `(SELECT ('spent' || "Item".id) as id, "Item".id as "factId", NULL as bolt11,
      MAX("ItemAct".created_at) as "createdAt", sum("ItemAct".msats) as msats,
      0 as "msatsFee", NULL as status, 'spent' as type
      FROM "ItemAct"
      JOIN "Item" on "ItemAct"."itemId" = "Item".id
      WHERE "ItemAct"."userId" = $1
      AND "ItemAct".created_at <= $2
      GROUP BY "Item".id)`)
    queries.push(
        `(SELECT ('donation' || "Donation".id) as id, "Donation".id as "factId", NULL as bolt11,
        created_at as "createdAt", sats * 1000 as msats,
        0 as "msatsFee", NULL as status, 'donation' as type
        FROM "Donation"
        WHERE "userId" = $1
        AND created_at <= $2)`)
  }

  if (queries.length === 0) {
    return {
      cursor: null,
      facts: []
    }
  }

  let history = await models.$queryRawUnsafe(`
  ${queries.join(' UNION ALL ')}
  ORDER BY "createdAt" DESC
  OFFSET $3
  LIMIT ${limit}`, me?.id, decodedCursor.time, decodedCursor.offset)

  history = history.map(f => {
    if (f.bolt11) {
      const inv = lnpr.decode(f.bolt11)
      if (inv) {
        const { tags } = inv
        for (const tag of tags) {
          if (tag.tagName === 'description') {
            f.description = tag.data
            break
          }
        }
      }
    }
    switch (f.type) {
      case 'withdrawal':
        f.msats = (-1 * Number(f.msats)) - Number(f.msatsFee)
        break
      case 'spent':
        f.msats *= -1
        break
      case 'donation':
        f.msats *= -1
        break
      default:
        break
    }

    return f
  })

  return {
    cursor: history.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
    facts: history
  }
}

exports.Fact = {
  item: async (fact, args, { models }) => {
    if (fact.type !== 'spent' && fact.type !== 'stacked') {
      return null
    }
    const [item] = await models.$queryRawUnsafe(`
      ${SELECT}
      FROM "Item"
      WHERE id = $1`, Number(fact.factId))

    return item
  },
  sats: fact => msatsToSatsDecimal(fact.msats),
  satsFee: fact => msatsToSatsDecimal(fact.msatsFee)
}
