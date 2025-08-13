import { deletePayment } from 'ln-service'
import { INVOICE_RETENTION_DAYS } from '@/lib/constants'
import { Prisma } from '@prisma/client'

// TODO: test this
export async function dropBolt11 ({ userId, hash } = {}, { models, lnd }) {
  const retention = `${INVOICE_RETENTION_DAYS} days`

  // This query will update the withdrawls and return what the hash and bol11 values were before the update
  const payOutBolt11s = await models.$queryRaw`
    WITH to_be_updated AS (
      SELECT id, hash, bolt11
      FROM "PayOutBolt11"
      WHERE "userId" ${userId ? Prisma.sql`= ${userId}` : Prisma.sql`(SELECT id FROM users WHERE "autoDropBolt11s")`}
      AND now() > created_at + ${retention}::INTERVAL
      AND hash ${hash ? Prisma.sql`= ${hash}` : Prisma.sql`IS NOT NULL`}
      AND status IS NOT NULL
    ), updated_rows AS (
      UPDATE "PayOutBolt11"
      SET hash = NULL, bolt11 = NULL, preimage = NULL
      FROM to_be_updated
      WHERE "PayOutBolt11".id = to_be_updated.id)
    SELECT * FROM to_be_updated;`

  if (payOutBolt11s.length > 0) {
    for (const payOutBolt11 of payOutBolt11s) {
      try {
        await deletePayment({ id: payOutBolt11.hash, lnd })
      } catch (error) {
        console.error(`Error removing invoice with hash ${payOutBolt11.hash}:`, error)
        await models.payOutBolt11.update({
          where: { id: payOutBolt11.id },
          data: { hash: payOutBolt11.hash, bolt11: payOutBolt11.bolt11, preimage: payOutBolt11.preimage }
        })
      }
    }
  }
}

export async function autoDropBolt11s ({ models, lnd }) {
  await dropBolt11(undefined, { models, lnd })
}
