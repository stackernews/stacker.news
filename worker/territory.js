import serialize from '../api/resolvers/serial'
import { paySubQueries } from '../api/resolvers/sub'
import { TERRITORY_GRACE_DAYS } from '../lib/constants'
import { datePivot } from '../lib/time'

export async function territoryBilling ({ data: { subName }, boss, models }) {
  const sub = await models.sub.findUnique({
    where: {
      name: subName
    }
  })

  try {
    const queries = paySubQueries(sub, models)
    await serialize(models, ...queries)
  } catch (e) {
    console.error(e)

    await models.sub.update({
      where: {
        name: subName
      },
      data: {
        status: sub.billedLastAt >= datePivot(new Date(), { days: -TERRITORY_GRACE_DAYS }) ? 'GRACE' : 'STOPPED'
      }
    })
    // retry billing in one day
    await boss.send('territoryBilling', { subName }, { startAfter: datePivot(new Date(), { days: 1 }) })
  }
}
