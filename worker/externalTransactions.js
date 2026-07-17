import { WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS } from '@/lib/constants'
import { withTimeoutSignal, sleep } from '@/lib/time'
import { protocolCheckInvoice } from '@/wallets/server/protocols'
import { checkLnurlVerifyInvoice } from '@/wallets/server/protocols/lnurlVerify'
import {
  claimExternalTransactionChecks,
  recordExternalTransactionObservation
} from '@/wallets/server/external-transactions'
import { toExternalTransactionObservation } from '@/wallets/lib/external-transactions'

// The cron fires each minute; this loop drains due rows for most of the tick,
// sleeping briefly between sweeps so born-hot rows get sub-minute pickup.
// Claims make overlapping runs harmless.
export async function checkPendingExternalTransactions ({ models, tickBudgetMs = 50_000 }) {
  const deadline = Date.now() + Math.max(0, tickBudgetMs)
  do {
    let transactions
    do {
      transactions = await checkDueExternalTransactionBatch({ models })
    } while (transactions.length > 0 && Date.now() < deadline)

    const delay = Math.min(5_000, deadline - Date.now())
    if (delay <= 0) return
    await sleep(delay)
  } while (Date.now() < deadline)
}

async function checkDueExternalTransactionBatch ({ models }) {
  const transactions = await claimExternalTransactionChecks(models)
  await Promise.all(
    transactions.map(tx =>
      checkExternalTransaction({ models, tx })
        .catch(err => console.error('error checking external wallet transaction', tx.id, err)))
  )
  return transactions
}

export async function checkExternalTransaction ({ models, tx }) {
  let result
  let providerError
  try {
    if (tx.direction === 'SEND') {
      if (tx.verificationContext?.lnurlVerifyUrl) {
        result = await withTimeoutSignal(
          WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS,
          signal => checkLnurlVerifyInvoice(tx, null, { signal })
        )
      }
    } else {
      result = await withTimeoutSignal(WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS, signal =>
        protocolCheckInvoice(tx.checkProtocol, tx, tx.checkProtocol?.config, { signal }))
    }
  } catch (err) {
    providerError = err
  }

  return await recordExternalTransactionObservation(
    models,
    tx,
    toExternalTransactionObservation(result, { error: providerError })
  )
}
