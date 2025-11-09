import { Prisma } from '@prisma/client'

export async function expireBoost ({ data: { id }, models }) {
  // reset boost 30 days after last boost
  // run in serializable because we use an aggregate here
  // and concurrent boosts could be double counted
  // serialization errors will cause pgboss retries
  await models.$transaction(
    [
      models.$executeRaw`
        WITH boost AS (
          SELECT sum("mcost") FILTER (WHERE "PayIn"."payInStateChangedAt" <= now() - interval '30 days') as old_msats,
                sum("mcost") FILTER (WHERE "PayIn"."payInStateChangedAt" > now() - interval '30 days') as cur_msats
          FROM "PayIn"
          JOIN "ItemPayIn" ON "ItemPayIn"."payInId" = "PayIn"."id"
          WHERE "payInType" = 'BOOST'
          AND "itemId" = ${Number(id)}::INTEGER
          AND "payInState" = 'PAID'
        )
        UPDATE "Item"
        SET boost = COALESCE(boost.cur_msats, 0) / 1000, "oldBoost" = COALESCE(boost.old_msats, 0) / 1000
        FROM boost
        WHERE "Item".id = ${Number(id)}::INTEGER`
    ],
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  )
}
