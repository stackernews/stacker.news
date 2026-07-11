import { LEDGER_TYPE } from '@/wallets/lib/external-transaction-ledger'

// Book a batch of entries. `tx` is the interactive-transaction client, NOT `models`. skipDuplicates makes a
// raced terminal/obligation closer a silent no-op: it collapses onto the ExternalTransactionLedger_*_uniq
// partial indexes (an unqualified ON CONFLICT DO NOTHING catches partial unique indexes) instead of throwing.
export async function insertLedgerEntries (tx, entries) {
  if (!entries?.length) return
  await tx.externalTransactionLedger.createMany({ data: entries, skipDuplicates: true })
}

// Sum of already-booked FULFILLMENT magnitude for a transaction, used to compute the still-open amount
// (obligation - fulfilled) that a terminal closer books. Runs inside the same $transaction as the closer so
// it sees a consistent snapshot.
export async function fulfilledMsats (tx, externalTransactionId) {
  const { _sum } = await tx.externalTransactionLedger.aggregate({
    _sum: { amountMsats: true },
    where: { externalTransactionId, type: LEDGER_TYPE.FULFILLMENT }
  })
  return _sum.amountMsats ?? 0n
}
