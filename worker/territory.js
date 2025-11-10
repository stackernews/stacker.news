import pay from '@/api/payIn'
import { nextBillingWithGrace } from '@/lib/territory'
import { datePivot } from '@/lib/time'

export async function territoryBilling ({ data: { subName }, boss, models }) {
  const sub = await models.sub.findUnique({
    where: {
      name: subName
    },
    include: {
      user: true
    }
  })

  async function territoryStatusUpdate () {
    if (sub.status !== 'STOPPED') {
      await models.sub.update({
        include: { user: true },
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
    const { result } = await pay('TERRITORY_BILLING',
      { name: subName }, {
        models,
        me: sub.user,
        custodialOnly: true
      })
    if (!result) {
      throw new Error('not enough fee credits to auto-renew territory')
    }
  } catch (e) {
    console.error(e)
    await territoryStatusUpdate()
  }
}
