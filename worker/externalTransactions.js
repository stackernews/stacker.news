import { timeoutSignal } from '@/lib/time'
import { errorMessage } from '@/lib/error'
import { protocolCheckInvoice } from '@/wallets/server/protocols'
import {
  externalTransactionUnknown,
  externalTransactionDiagnosticMessage,
  externalTransactionUnknownReasonForError,
  externalTransactionPollingDeadline,
  externalTransactionExpiredUnpaid,
  externalTransactionCheckStopped,
  POLLABLE_SETTLEMENT_STATUSES,
  TAIL_CHECK_INTERVAL_MS,
  MAX_CHECK_AGE_MS,
  EXTERNAL_TRANSACTION_UNKNOWN_REASONS,
  TERMINAL_STATUSES
} from '@/wallets/lib/external-transactions'
import { writeWalletLog } from '@/wallets/server/logger'
import {
  applyExternalTransactionChange,
  externalTransactionInclude,
  rearmExternalTransactionCheck
} from '@/wallets/server/external-transactions'

const CHECK_BATCH_SIZE = 25
const CHECK_TIMEOUT_MS = 10_000

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
        settlementStatus: { in: POLLABLE_SETTLEMENT_STATUSES },
        // the long tail + the broken-chain backstop, unified: any row idle longer than the tail interval,
        // whether because the chain handed off after the hot window or because it died early.
        updatedAt: { lt: new Date(now - TAIL_CHECK_INTERVAL_MS) },
        createdAt: { gt: new Date(now - MAX_CHECK_AGE_MS) },
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
  // a stopped UNKNOWN row (permanent stop-reason or past the polling deadline) will never change, so skip
  if (tx.settlementStatus === 'UNKNOWN' && externalTransactionCheckStopped(tx)) return tx

  let result
  let error
  try {
    result = await protocolCheckInvoice(
      tx.protocol,
      tx,
      tx.protocol.config,
      { signal: timeoutSignal(CHECK_TIMEOUT_MS) }
    )
  } catch (err) {
    error = err
  }

  const change = externalTransactionCheckChange(tx, result, error)
  const updated = await applyExternalTransactionChange(models, tx, change)
  await logExternalTransactionCheck(models, tx, updated)
  // re-arm the next check as a fresh pgboss job (per-attempt singletonkey dodges the active-job
  // singleton that blocked a self-re-arm before). The every-minute reaper only steps in if this breaks.
  await rearmExternalTransactionCheck(models, updated)
  return updated
}

async function logExternalTransactionCheck (models, before, after) {
  if (!after) return
  if (before.settlementStatus === after.settlementStatus) {
    if (before.unknownReason === after.unknownReason && before.error === after.error) return
  }

  const log = externalTransactionLog(after)
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

function externalTransactionLog (transaction) {
  if (transaction.settlementStatus === 'SETTLED') {
    return { level: 'OK', message: 'receive settled' }
  }
  if (transaction.settlementStatus === 'FAILED') {
    return {
      level: 'ERROR',
      message: transaction.error ? `receive failed: ${transaction.error}` : 'receive failed'
    }
  }
  if (transaction.settlementStatus === 'UNKNOWN') {
    return {
      level: 'WARNING',
      message: `receive status unknown: ${externalTransactionDiagnosticMessage(transaction)}`,
      context: stripNullish({
        unknown_reason: transaction.unknownReason,
        provider_error: transaction.error
      })
    }
  }
  return null
}

function stripNullish (object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value != null))
}

function externalTransactionCheckChange (transaction, result, error) {
  if (error) {
    const reason = externalTransactionUnknownReasonForError(error)
    return externalTransactionUnknown({ reason, error: errorMessage(error) })
  }

  if (!result) {
    return externalTransactionUnknown({
      reason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED,
      error: 'wallet protocol cannot verify invoice status'
    })
  }

  if (result.status === 'SETTLED') {
    return {
      settlementStatus: 'SETTLED',
      preimage: result.preimage,
      settledAt: result.settledAt,
      ...(result.msats != null ? { amountMsats: result.msats } : {}),
      feeMsats: result.actualFeeMsats,
      error: null
    }
  }

  if (result.status === 'FAILED') {
    return {
      settlementStatus: 'FAILED',
      error: result.error
    }
  }

  if (result.status === 'UNKNOWN') {
    const reason = result.unknownReason ?? EXTERNAL_TRANSACTION_UNKNOWN_REASONS.STATUS_UNAVAILABLE
    return externalTransactionUnknown({ reason, error: result.error ?? null })
  }

  // provider still reports PENDING: keep polling until the deadline (expiry+grace or the age wall),
  // then go terminal.
  if (Date.now() >= externalTransactionPollingDeadline(transaction)) {
    if (externalTransactionExpiredUnpaid(transaction)) {
      return { settlementStatus: 'FAILED', error: 'invoice expired' }
    }
    return externalTransactionUnknown({
      reason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.STATUS_UNAVAILABLE,
      error: 'gave up confirming receive before a definitive status'
    })
  }

  return {
    settlementStatus: 'PENDING',
    // a still-pending recheck is healthy: clear any prior diagnostic
    error: null,
    unknownReason: null,
    unknownMessage: null
  }
}
