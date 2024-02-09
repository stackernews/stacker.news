import serialize from '../api/resolvers/serial'
import { paySubQueries } from '../api/resolvers/sub'
import { nextBillingWithGrace } from '../lib/territory'
import { datePivot } from '../lib/time'

export async function territoryBilling ({ data: { subName }, boss, models }) {
  const sub = await models.sub.findUnique({
    where: {
      name: subName
    }
  })

  async function territoryStatusUpdate () {
    if (sub.status !== 'STOPPED') {
      await models.sub.update({
        where: {
          name: subName
        },
        data: {
          status: nextBillingWithGrace(sub) >= new Date() ? 'GRACE' : 'STOPPED',
          statusUpdatedAt: new Date()
        }
      })
    }

    // retry billing in one day
    await boss.send('territoryBilling', { subName }, { startAfter: datePivot(new Date(), { days: 1 }) })
  }

  if (!sub.billingAutoRenew) {
    await territoryStatusUpdate()
    return
  }

  try {
    const queries = paySubQueries(sub, models)
    await serialize(models, ...queries)
  } catch (e) {
    console.error(e)
    await territoryStatusUpdate()
  }
}
