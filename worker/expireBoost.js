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
          SELECT sum(msats) FILTER (WHERE created_at <= now() - interval '30 days') as old_msats
                sum(msats) FILTER (WHERE created_at > now() - interval '30 days') as cur_msats
          FROM "ItemAct"
          WHERE act = 'BOOST'
          AND "itemId" = ${Number(id)}::INTEGER
        )
        UPDATE "Item"
        SET "Item".boost = boost.cur_msats, "Item"."oldBoost" = boost.old_msats
        WHERE "Item".id = ${Number(id)}::INTEGER`
    ],
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  )
}
