const { gql } = require('graphql-tag')
const fs = require('fs')
const { CsvRequest, CsvRequestStatus } = require('../lib/constants')

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

  query WalletHistory($cursor: String, $inc: String, $limit: Int, $id: Int) {
    walletHistory(cursor: $cursor, inc: $inc, limit: $limit, id: $id) {
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
      ({ data: { walletHistory: { facts, cursor } } } = await apollo.query({
        query: WALLET_HISTORY,
        variables: { cursor, limit: 1, inc: 'invoice,withdrawal,stacked,spent', id }
      }))

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
