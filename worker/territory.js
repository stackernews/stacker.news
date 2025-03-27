import lnd from '@/api/lnd'
import performPaidAction from '@/api/paidAction'
import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { nextBillingWithGrace } from '@/lib/territory'
import { datePivot } from '@/lib/time'
import { notifyTerritoryStatusChange, notifyTerritoryRevenue } from '@/lib/webPush'

export async function territoryBilling ({ data: { subName }, boss, models }) {
  let sub = await models.sub.findUnique({
    where: {
      name: subName
    }
  })

  async function territoryStatusUpdate () {
    if (sub.status !== 'STOPPED') {
      sub = await models.sub.update({
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
    // send push notification with the new status
    await notifyTerritoryStatusChange({ sub })
    // retry billing in one day
    await boss.send('territoryBilling', { subName }, { startAfter: datePivot(new Date(), { days: 1 }) })
  }

  if (!sub.billingAutoRenew) {
    await territoryStatusUpdate()
    return
  }

  try {
    const { result } = await performPaidAction('TERRITORY_BILLING',
      { name: subName }, {
        models,
        me: sub.user,
        lnd,
        forcePaymentMethod: PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT
      })
    console.log('result', result)
    if (!result) {
      throw new Error('not enough fee credits to auto-renew territory')
    } else if (sub.status === 'GRACE' && result.status === 'ACTIVE') {
      // if the sub was in grace and we successfully auto-renewed it, send a push notification
      await notifyTerritoryStatusChange({ sub })
    }
  } catch (e) {
    console.error(e)
    await territoryStatusUpdate()
  }
}

export async function territoryRevenue ({ models }) {
  // this is safe nonserializable because it only acts on old data that won't
  // be affected by concurrent updates ... and the update takes a lock on the
  // users table
  await models.$executeRaw`
      WITH revenue AS (
        SELECT coalesce(sum(msats), 0) as revenue, "subName", "userId"
        FROM (
          SELECT ("ItemAct".msats - COALESCE("ReferralAct".msats, 0)) * (1 - (COALESCE("Sub"."rewardsPct", 100) * 0.01)) as msats,
            "Sub"."name" as "subName", "Sub"."userId" as "userId"
            FROM "ItemAct"
            JOIN "Item" ON "Item"."id" = "ItemAct"."itemId"
            LEFT JOIN "Item" root ON "Item"."rootId" = root.id
            JOIN "Sub" ON "Sub"."name" = COALESCE(root."subName", "Item"."subName")
            LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = "ItemAct".id
            WHERE date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', (now() AT TIME ZONE 'America/Chicago' - interval '1 day'))
              AND "ItemAct".act <> 'TIP'
              AND "Sub".status <> 'STOPPED'
              AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
        ) subquery
        GROUP BY "subName", "userId"
      ),
      "SubActResult" AS (
        INSERT INTO "SubAct" (msats, "subName", "userId", type)
        SELECT revenue, "subName", "userId", 'REVENUE'
        FROM revenue
        WHERE revenue > 1000
        RETURNING *
      ),
      "SubActResultTotal" AS (
        SELECT coalesce(sum(msats), 0) as total_msats, "userId"
        FROM "SubActResult"
        GROUP BY "userId"
      )
      UPDATE users
      SET msats = users.msats + "SubActResultTotal".total_msats,
        "stackedMsats" = users."stackedMsats" + "SubActResultTotal".total_msats
      FROM "SubActResultTotal"
      WHERE users.id = "SubActResultTotal"."userId"`

  const territoryRevenue = await models.subAct.findMany({
    where: {
      createdAt: { // retrieve revenue calculated in the last hour
        gte: datePivot(new Date(), { hours: -1 })
      },
      type: 'REVENUE'
    }
  })

  await Promise.allSettled(
    territoryRevenue.map(subAct => notifyTerritoryRevenue(subAct))
  )
}
