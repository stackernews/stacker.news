const fs = require('fs')
const { CsvRequest, CsvRequestStatus } = require('../lib/constants')
const { walletHistory, Fact } = require('../api/resolvers/wallet-common')
const path = require('path')

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
  const fname = path.join(process.env.CSV_PATH, `satistics_${id}.csv`)
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
      ({ cursor, facts } = await walletHistory(null, { cursor, inc: 'invoice,withdrawal,stacked,spent', limit: 1 }, { me: { id }, models, lnd: null }))

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
