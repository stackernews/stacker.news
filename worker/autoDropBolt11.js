import { deletePayment } from '@/api/lnd'
import { INVOICE_RETENTION_DAYS } from '@/lib/constants'

export async function autoDropBolt11s ({ models, lnd }) {
  const retention = `${INVOICE_RETENTION_DAYS} days`

  // This query will update the withdrawls and return what the hash and bol11 values were before the update
  const invoices = await models.$queryRaw`
    WITH to_be_updated AS (
      SELECT id, hash, bolt11
      FROM "Withdrawl"
      WHERE "userId" IN (SELECT id FROM users WHERE "autoDropBolt11s")
      AND now() > created_at + ${retention}::INTERVAL
      AND hash IS NOT NULL
      AND status IS NOT NULL
    ), updated_rows AS (
      UPDATE "Withdrawl"
      SET hash = NULL, bolt11 = NULL, preimage = NULL
      FROM to_be_updated
      WHERE "Withdrawl".id = to_be_updated.id)
    SELECT * FROM to_be_updated;`

  if (invoices.length > 0) {
    for (const invoice of invoices) {
      try {
        await deletePayment({ id: invoice.hash, lnd })
      } catch (error) {
        console.error(`Error removing invoice with hash ${invoice.hash}:`, error)
        await models.withdrawl.update({
          where: { id: invoice.id },
          data: { hash: invoice.hash, bolt11: invoice.bolt11, preimage: invoice.preimage }
        })
      }
    }
  }

  await models.$queryRaw`
    UPDATE "DirectPayment"
    SET hash = NULL, bolt11 = NULL, preimage = NULL
    WHERE "receiverId" IN (SELECT id FROM users WHERE "autoDropBolt11s")
    AND now() > created_at + ${retention}::INTERVAL
    AND hash IS NOT NULL`
}
