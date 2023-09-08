const fs = require('fs')
const { CsvRequest, CsvRequestStatus } = require('../lib/constants')
const lnpr = require('bolt11')

//
//
// BEGINNING OF DUPLICATED CODE FROM APP /////////////////

const LIMIT = 21

function decodeCursor (cursor) {
  if (!cursor) {
    return { offset: 0, time: new Date() }
  } else {
    const res = JSON.parse(Buffer.from(cursor, 'base64'))
    res.time = new Date(res.time)
    return res
  }
}

function nextCursorEncoded (cursor, limit = LIMIT) {
  cursor.offset += limit
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}

async function walletHistory (parent, { cursor, inc, limit = LIMIT, id }, { me, models, lnd }) {
  const decodedCursor = decodeCursor(cursor)

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
  LIMIT ${limit}`, me?.id || id, decodedCursor.time, decodedCursor.offset)

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

const Fact = {
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

const SELECT =
  `SELECT "Item".id, "Item".created_at, "Item".created_at as "createdAt", "Item".updated_at,
  "Item".updated_at as "updatedAt", "Item".title, "Item".text, "Item".url, "Item"."bounty",
  "Item"."userId", "Item"."parentId", "Item"."pinId", "Item"."maxBid",
  "Item"."rootId", "Item".upvotes, "Item".company, "Item".location, "Item".remote, "Item"."deletedAt",
  "Item"."subName", "Item".status, "Item"."uploadId", "Item"."pollCost", "Item".boost, "Item".msats,
  "Item".ncomments, "Item"."commentMsats", "Item"."lastCommentAt", "Item"."weightedVotes",
  "Item"."weightedDownVotes", "Item".freebie, "Item"."otsHash", "Item"."bountyPaidTo",
  ltree2text("Item"."path") AS "path", "Item"."weightedComments"`

const msatsToSatsDecimal = msats => {
  if (msats === null || msats === undefined) {
    return null
  }
  return fixedDecimal(Number(msats) / 1000.0, 3)
}

const fixedDecimal = (n, f) => {
  return Number.parseFloat(n).toFixed(f)
}

// END OF DUPLICATED CODE /////////////////
//
//

function delay (millisec) {
  return new Promise(resolve => {
    setTimeout(() => { resolve('') }, millisec)
  })
}

function checkCsv ({ models, apollo }) {
  return async function ({ data: { id } }) {
    const status = await models.user.findUnique({
      where: {
        id
      },
      select: {
        id: true,
        csvRequest: true,
        csvRequestStatus: true
      }
    })
    if (status.csvRequest === CsvRequest.NO_REQUEST &&
    (status.csvRequestStatus === CsvRequestStatus.FAILED || status.csvRequestStatus === CsvRequestStatus.DONE)) {
      console.log('user request cleared')
      await models.$transaction([
        models.$executeRaw`UPDATE "users" SET "csvRequestStatus" = 'NO_REQUEST' WHERE "users"."id" = ${id}`])
    } else if (status.csvRequest === CsvRequest.FULL_REPORT &&
    (status.csvRequestStatus === CsvRequestStatus.NO_REQUEST || status.csvRequestStatus === CsvRequestStatus.FAILED)) {
      makeCsv({ models, apollo, id })
    }
  }
}

async function makeCsv ({ models, apollo, id }) {
  await models.$transaction([
    models.$executeRaw`UPDATE "users" SET "csvRequestStatus" = 'IN_PROGRESS' WHERE "users"."id" = ${id}`])
  const fname = `satistics_${id}.csv`
  const s = fs.createWriteStream(fname)
  let facts = []; let cursor = null
  let status; let incomplete = false
  console.log('started new CSV file')
  s.write('time,type,sats\n')
  let i = 0
  do {
    // query for items
    await delay(1000) // <- adjust delay and 'limit' (in query below) for preferred idle:work ratio
    console.log(++i)
    try {
      ({ cursor, facts } = await walletHistory(null, { cursor, inc: 'invoice,withdrawal,stacked,spent', limit: 1, id }, { me: null, models, lnd: null }))

      // to backfill what the GQL pipeline does
      for (const fact of facts) {
        fact.item = await Fact.item(fact, null, { models })
        fact.sats = Fact.sats(fact)
        fact.satsFee = Fact.satsFee(fact)
      }

      // for all items, index them
      for (const fact of facts) {
        if (!fact.status || fact.status === 'CONFIRMED') {
          s.write(`${fact.createdAt},${fact.type},${fact.sats}\n`)
        }
      }
    } catch (e) {
      // ignore errors
      incomplete = true
      console.log(e)
      s.end()
    }

    // check for cancellation
    status = await models.user.findUnique({
      where: {
        id
      },
      select: {
        id: true,
        csvRequest: true,
        csvRequestStatus: true
      }
    })
    if (status.csvRequest !== CsvRequest.FULL_REPORT) {
      // user canceled
      incomplete = true
    }
  } while (cursor && !incomplete)

  // result
  s.end()
  const newState = incomplete ? CsvRequestStatus.FAILED : CsvRequestStatus.DONE
  console.log('done with CSV file', newState)
  await models.$transaction([
    models.$executeRaw`UPDATE "users" SET "csvRequestStatus" = CAST(${newState} as "CsvRequestStatus") WHERE "users"."id" = ${id}`])
}

module.exports = { checkCsv }
