const serialize = require('../api/resolvers/serial')

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

    // calculate the total trust
    const { sum: { trust } } = await models.user.aggregate({
      sum: {
        trust: true
      }
    })

    // get earners { id, earnings }
    const earners = await models.$queryRaw(`
      SELECT id, FLOOR(${sum} * (trust/${trust}) * 1000) as earnings
      FROM users
      WHERE trust > 0`)

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

// earn historical ... TODO: delete after announcement
function earnHistorical ({ models }) {
  return async function ({ name }) {
    console.log('running', name)

    // compute how much sn earned today
    const [{ sum }] = await models.$queryRaw`
        SELECT sum("ItemAct".sats)
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        WHERE ("ItemAct".act in ('BOOST', 'STREAM')
          OR ("ItemAct".act = 'VOTE' AND "Item"."userId" = "ItemAct"."userId"))`

    // add in the job sats that weren't recorded from jobs
    const fullSum = 200000 + sum

    // calculate the total trust
    const { sum: { trust } } = await models.user.aggregate({
      sum: {
        trust: true
      }
    })

    // get earners { id, earnings }
    const earners = await models.$queryRaw(`
      SELECT id, FLOOR(${fullSum} * (trust/${trust}) * 1000) as earnings
      FROM users
      WHERE trust > 0`)

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

module.exports = { earn, earnHistorical }
