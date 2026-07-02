import { deletePayment } from 'ln-service'
import { INVOICE_RETENTION_DAYS } from '@/lib/constants'
import { Prisma } from '@prisma/client'

export async function dropBolt11 ({ userId, hash } = {}, { models, lnd }) {
  const retention = `${INVOICE_RETENTION_DAYS} days`

  // This query will update the withdrawls and return what the hash and bol11 values were before the update
  const payOutBolt11s = await models.$queryRaw`
    WITH to_be_updated AS (
      SELECT id, hash, bolt11
      FROM "PayOutBolt11"
      WHERE "userId" ${userId ? Prisma.sql`= ${userId}` : Prisma.sql`IN (SELECT id FROM users WHERE "autoDropBolt11s")`}
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

  await dropExternalTransactionBolt11s({ userId, hash }, { models, retention })
}

export async function autoDropBolt11s ({ models, lnd }) {
  await dropBolt11(undefined, { models, lnd })
}

async function dropExternalTransactionBolt11s ({ userId, hash } = {}, { models, retention }) {
  // any row this old (retention ≫ the 24h polling deadline) has definitively stopped being checked,
  // including sends abandoned as PENDING (sends are only finalized by signed-in clients). Flip those
  // to UNKNOWN in the same pass: once hash/bolt11 are nulled the client reconciler can never finalize
  // them, so a scrubbed PENDING row would read "pending" forever.
  await models.$executeRaw`
    UPDATE "ExternalTransaction"
    -- BOLT11 "sourceValue" duplicates the invoice, so purge it too;
    -- LN_ADDR "sourceValue" is the intended post-drop display context and dedupe key
    SET hash = NULL, bolt11 = NULL, preimage = NULL,
        "sourceValue" = CASE WHEN "sourceType" = 'BOLT11' THEN NULL ELSE "sourceValue" END,
        "unknownReason" = CASE WHEN "settlementStatus" = 'PENDING'
          THEN 'STATUS_UNAVAILABLE'::"ExternalTransactionUnknownReason" ELSE "unknownReason" END,
        "settlementStatus" = CASE WHEN "settlementStatus" = 'PENDING'
          THEN 'UNKNOWN'::"ExternalTransactionSettlementStatus" ELSE "settlementStatus" END
    WHERE "userId" ${userId ? Prisma.sql`= ${userId}` : Prisma.sql`IN (SELECT id FROM users WHERE "autoDropBolt11s")`}
      AND now() > created_at + ${retention}::INTERVAL
      AND hash ${hash ? Prisma.sql`= ${hash}` : Prisma.sql`IS NOT NULL`}`
}
