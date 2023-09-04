const { gql } = require('graphql-tag')
const fs = require('fs')

const ITEM_FIELDS = gql`
  fragment ItemFields on Item {
    id
    parentId
    createdAt
    deletedAt
    title
    url
    user {
      name
      streak
      hideCowboyHat
      id
    }
    otsHash
    position
    sats
    meAnonSats @client
    boost
    bounty
    bountyPaidTo
    path
    upvotes
    meSats
    meDontLike
    meBookmark
    meSubscription
    meForward
    outlawed
    freebie
    ncomments
    commentSats
    lastCommentAt
    maxBid
    isJob
    company
    location
    remote
    subName
    pollCost
    status
    uploadId
    mine
  }`

const ITEM_FULL_FIELDS = gql`
  ${ITEM_FIELDS}
  fragment ItemFullFields on Item {
    ...ItemFields
    text
    root {
      id
      title
      bounty
      bountyPaidTo
      subName
      user {
        name
        streak
        hideCowboyHat
        id
      }
    }
    forwards {
      userId
      pct
      user {
        name
      }
    }
  }`

const WALLET_HISTORY = gql`
  ${ITEM_FULL_FIELDS}

  query WalletHistory($cursor: String, $inc: String, $limit: Int, $meId: Int) {
    walletHistory(cursor: $cursor, inc: $inc, limit: $limit, meId: $meId) {
      facts {
        id
        factId
        type
        createdAt
        sats
        satsFee
        status
        type
        description
        item {
          ...ItemFullFields
        }
      }
      cursor
    }
  }
`

// this should be run regularly ... like, every 1-5 minutes
function updateCsvs ({ models, apollo }) {
  return async function () {
    console.log('checking CSV work')
    const todo = await models.user.findMany({
      where: {
        // conceptually, this is what we want:
        // csvRequest: { not: models.user.fields.csvRequestStatus }
        // but because the enums are of different types, we have to do this:
        OR: [
          { AND: [{ csvRequest: 'NO_REQUEST' }, { csvRequestStatus: { not: 'NO_REQUEST' } }] },
          { AND: [{ csvRequest: 'FULL_REPORT' }, { csvRequestStatus: { not: 'FULL_REPORT' } }] }
        ]
      },
      select: {
        id: true,
        csvRequest: true,
        csvRequestStatus: true
      }
    })

    if (todo.length === 0) return

    console.log('checking', todo.length, 'CSV request(s)')

    for (const req of todo) {
      if (req.csvRequest === 'FULL_REPORT' && req.csvRequestStatus === 'NO_REQUEST') {
        console.log('starting CSV preparation', req)
        await models.$transaction([
          models.$executeRaw`UPDATE "users" SET "csvRequestStatus" = 'GENERATING_REPORT' WHERE "users"."id" = ${req.id}`])
        createCsv(`satistics_${req.id}.csv`, req.id, apollo, models)
      } else if (req.csvRequest === 'NO_REQUEST' && req.csvRequestStatus === 'FULL_REPORT') {
        await models.$transaction([
          models.$executeRaw`UPDATE "users" SET "csvRequestStatus" = 'NO_REQUEST' WHERE "users"."id" = ${req.id}`])
      } else if (req.csvRequest === 'NO_REQUEST' && req.csvRequestStatus === 'INCOPLETE') {
        await models.$transaction([
          models.$executeRaw`UPDATE "users" SET "csvRequestStatus" = 'NO_REQUEST' WHERE "users"."id" = ${req.id}`])
      }
    }

    console.log('end of CSV management')
  }
}

async function createCsv (fname, id, apollo, models) {
  const s = fs.createWriteStream(fname)
  let facts = []; let cursor = null
  let status; let incomplete = false
  console.log('started new CSV file')
  s.write('time,type,sats\n')
  do {
    // query for items
    ({ data: { walletHistory: { facts, cursor } } } = await apollo.query({
      query: WALLET_HISTORY,
      variables: { cursor, limit: 1000, inc: 'invoice,withdrawal,stacked,spent', meId: id }
    }))

    // for all items, index them
    try {
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
    if (status.csvRequest !== 'FULL_REPORT') {
      // user canceled
      incomplete = true
    }
  } while (cursor && !incomplete)

  s.end()
  const newState = incomplete ? 'INCOMPLETE' : 'FULL_REPORT'
  console.log('done with CSV file', newState)
  await models.$transaction([
    models.$executeRaw`UPDATE "users" SET "csvRequestStatus" = CAST(${newState} as "CsvRequestStatus") WHERE "users"."id" = ${id}`])
}

module.exports = { updateCsvs }
