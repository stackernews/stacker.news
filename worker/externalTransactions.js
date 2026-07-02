import { WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS } from '@/lib/constants'
import { withTimeoutSignal } from '@/lib/time'
import { protocolCanCheckInvoice, protocolCheckInvoice } from '@/wallets/server/protocols'
import {
  classifyExternalTransactionCheck,
  externalTransactionDiagnosticMessage,
  externalTransactionFinal,
  externalTransactionResolvesLocally,
  TERMINAL_STATUSES
} from '@/wallets/lib/external-transactions'
import { writeWalletLog } from '@/wallets/server/logger'
import {
  applyExternalTransactionChange,
  externalTransactionCheckableWhere,
  externalTransactionInclude
} from '@/wallets/server/external-transactions'

const CHECK_BATCH_SIZE = 25
const TAIL_CHECK_INTERVAL_MS = 45_000

export async function checkExternalTransactionJob ({ data: { id }, models }) {
  await checkExternalTransaction({ id, models })
}

export async function checkPendingExternalTransactions ({ models }) {
  let cursorId
  const now = Date.now()

  while (true) {
    const transactions = await models.externalTransaction.findMany({
      where: {
        direction: 'RECEIVE',
        // the long tail + the broken-chain backstop, unified: any row idle longer than the tail interval,
        // whether because the chain handed off after the hot window or because it died early.
        updatedAt: { lt: new Date(now - TAIL_CHECK_INTERVAL_MS) },
        // the shared SQL mirror of the stop predicate; locally-resolvable rows
        // (expired unpaid receives) stay selectable so classify can terminalize them
        ...externalTransactionCheckableWhere({ now, includeLocallyResolvable: true }),
        ...(cursorId ? { id: { gt: cursorId } } : {})
      },
      orderBy: { id: 'asc' },
      take: CHECK_BATCH_SIZE,
      include: externalTransactionInclude()
    })

    if (transactions.length === 0) return

    // check the page concurrently, then page on. Awaiting the page keeps backpressure between pages and
    // bounds in-flight work to CHECK_BATCH_SIZE, while a slow/flaky provider only blocks its own check
    // instead of stalling the rest of the batch.
    cursorId = transactions[transactions.length - 1].id
    await Promise.allSettled(
      transactions.map(tx =>
        checkExternalTransaction({ id: tx.id, models, tx })
          .catch(err => console.error('error checking external wallet transaction', tx.id, err)))
    )
  }
}

export async function checkExternalTransaction ({ id, models, tx }) {
  // the reaper passes the row it already paged; the per-tx job path fetches it
  tx = tx ?? await models.externalTransaction.findUnique({
    where: { id: Number(id) },
    include: externalTransactionInclude()
  })
  if (!tx || TERMINAL_STATUSES.has(tx.settlementStatus) || tx.direction !== 'RECEIVE') return tx
  if (!tx.bolt11 || !tx.hash) return tx
  // a final (stopped UNKNOWN) row will never change, so skip — unless classify can still
  // terminalize it locally (expired unpaid receive → FAILED 'invoice expired')
  if (externalTransactionFinal(tx) && !externalTransactionResolvesLocally(tx)) return tx

  let result
  let error
  const canCheck = protocolCanCheckInvoice(tx.protocol)
  if (canCheck) {
    try {
      result = await withTimeoutSignal(WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS, signal =>
        protocolCheckInvoice(tx.protocol, tx, tx.protocol.config, { signal }))
    } catch (err) {
      error = err
    }
  }

  const change = classifyExternalTransactionCheck(tx, { result, error, canCheck })
  const updated = await applyExternalTransactionChange(models, tx, change)
  await logExternalTransactionCheck(models, tx, updated)
  return updated
}

async function logExternalTransactionCheck (models, before, after) {
  if (!after) return
  if (before.settlementStatus === after.settlementStatus) {
    if (before.unknownReason === after.unknownReason && before.error === after.error) return
  }

  let log
  if (after.settlementStatus === 'SETTLED') {
    log = { level: 'OK', message: 'receive settled' }
  } else if (after.settlementStatus === 'FAILED') {
    log = {
      level: 'ERROR',
      message: after.error ? `receive failed: ${after.error}` : 'receive failed'
    }
  } else if (after.settlementStatus === 'UNKNOWN') {
    log = {
      level: 'WARNING',
      message: `receive status unknown: ${externalTransactionDiagnosticMessage(after)}`,
      context: Object.fromEntries(
        Object.entries({ unknown_reason: after.unknownReason, provider_error: after.error })
          .filter(([, value]) => value != null))
    }
  }
  if (!log) return

  await writeWalletLog({
    models,
    protocolId: after.protocolId,
    userId: after.userId,
    externalTransactionId: after.id,
    level: log.level,
    message: log.message,
    context: log.context
  })
}
