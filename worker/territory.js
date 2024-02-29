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

export async function territoryRevenue ({ models }) {
  await serialize(models,
    models.$executeRaw`
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
            WHERE date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', (now() - interval '1 day') AT TIME ZONE 'America/Chicago')
              AND "ItemAct".act <> 'TIP'
              AND "Sub".status <> 'STOPPED'
        ) subquery
        GROUP BY "subName", "userId"
      ),
      "SubActResult" AS (
        INSERT INTO "SubAct" (msats, "subName", "userId", type)
        SELECT revenue, "subName", "userId", 'REVENUE'
        FROM revenue
        WHERE revenue > 1000
        RETURNING *
      )
      UPDATE users SET msats = users.msats + "SubActResult".msats
      FROM "SubActResult"
      WHERE users.id = "SubActResult"."userId"`
  )
}
