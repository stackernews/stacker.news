const fs = require('fs')
const { CsvStatus } = require('../lib/constants')
const { walletHistory, Fact } = require('../api/resolvers/wallet-common')
const path = require('path')

function checkCsv ({ models, apollo }) {
  return async function ({ data: { id } }) {
    try {
      const user = await models.user.findUnique({
        where: { id },
        select: { requestingCsv: true, csvStatus: true }
      })
      if (!user.requestingCsv && user.csvStatus !== CsvStatus.IN_PROGRESS) {
        await models.$transaction([
          models.$executeRaw`UPDATE "users" SET "csvStatus" = 'NO_REQUEST' WHERE "users"."id" = ${id}`])
      } else if (user.requestingCsv && user.csvStatus === CsvStatus.NO_REQUEST) {
        makeCsv({ models, id })
      }
    } catch (err) {
      console.log(err)
    }
  }
}

async function makeCsv ({ models, id }) {
  await models.$transaction([
    models.$executeRaw`UPDATE "users" SET "csvStatus" = 'IN_PROGRESS' WHERE "users"."id" = ${id}`])
  const fname = path.join(process.env.CSV_PATH, `satistics_${id}.csv`)
  const s = fs.createWriteStream(fname)
  let facts = []; let cursor = null
  let user; let incomplete = false
  console.log('started new CSV file')
  s.write('time,type,sats\n')
  do {
    // query for items
    try {
      ({ cursor, facts } = await walletHistory(null, {
        cursor,
        inc: 'invoice,withdrawal,stacked,spent',
        limit: 1000
      }, { me: { id }, models, lnd: null }))

      // we want Fact fields
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

      // check for user cancellation
      user = await models.user.findUnique({
        where: { id },
        select: { requestingCsv: true }
      })
      if (!user.requestingCsv) {
        // user canceled
        incomplete = true
      }
    } catch (err) {
      // ignore errors
      incomplete = true
      console.log(err)
    }
  } while (cursor && !incomplete)

  // result
  s.end()
  const endState = incomplete ? CsvStatus.FAILED : CsvStatus.DONE
  console.log('done with CSV file', endState)
  await models.$transaction([
    models.$executeRaw`UPDATE "users" SET "csvStatus" = CAST(${endState} as "CsvStatus") WHERE "users"."id" = ${id}`])
}

module.exports = { checkCsv }
