import serialize from '../api/resolvers/serial.js'

export async function auction ({ models }) {
  // get all items we need to check
  const items = await models.item.findMany(
    {
      where: {
        maxBid: {
          not: null
        },
        status: {
          not: 'STOPPED'
        }
      }
    }
  )

  // for each item, run serialized auction function
  items.forEach(async item => {
    await serialize(models,
      models.$executeRaw`SELECT run_auction(${item.id}::INTEGER)`)
  })
}
