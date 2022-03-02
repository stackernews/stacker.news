const serialize = require('../api/resolvers/serial')

function auction ({ models }) {
  return async function ({ name }) {
    console.log('running', name)
    // TODO: do this for each sub with auction ranking
    // because we only have one auction sub, we don't need to do this
    const SUB_BASE_COST = 10000
    const BID_DELTA = 1000

    // get all items we need to check in order of low to high bid
    const items = await models.item.findMany(
      {
        where: {
          maxBid: {
            not: null
          },
          status: {
            not: 'STOPPED'
          }
        },
        orderBy: {
          maxBid: 'asc'
        }
      }
    )

    // we subtract bid delta so that the lowest bidder, pays
    // the sub base cost
    let lastBid = SUB_BASE_COST - BID_DELTA
    // for each item, run serialized auction function
    for (const item of items) {
      let bid = lastBid
      // if this item's maxBid is great enough, have them pay more
      // else have them match the last bid
      if (item.maxBid >= lastBid + BID_DELTA) {
        bid = lastBid + BID_DELTA
      }

      const [{ run_auction: succeeded }] = await serialize(models,
        models.$queryRaw`SELECT run_auction(${item.id}, ${bid})`)

      // if we succeeded update the lastBid
      if (succeeded) {
        lastBid = bid
      }
    }

    console.log('done', name)
  }
}

module.exports = { auction }
