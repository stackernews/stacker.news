import { useApolloClient, useMutation } from '@apollo/client/react'
import { useCallback } from 'react'
import { useMe } from '@/components/me'
import { useWallets } from './global'
import { withClientSendProtocol } from './wallet'
import { usePollLoop } from '@/components/use-poll-loop'
import { UPDATE_EXTERNAL_TRANSACTION } from '@/wallets/client/fragments'
import { PENDING_EXTERNAL_SEND_TRANSACTIONS } from '@/fragments/payIn'
import { WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS } from '@/lib/constants'
import { isAbortLike, withTimeoutSignal } from '@/lib/time'
import {
  classifyExternalTransactionCheck,
  externalTransactionCheckStopped,
  externalTransactionFinal,
  protocolCanCheckPayment
} from '@/wallets/lib/external-transactions'

// Global client-side reconciler for external SENDs. Sends have no server job, so
// every signed-in page polls non-terminal rows until the shared deadline says stop.
export function useExternalSendChecks () {
  const client = useApolloClient()
  const { me } = useMe()
  const wallets = useWallets()
  const [updateExternalTransaction] = useMutation(UPDATE_EXTERNAL_TRANSACTION)

  const poll = useCallback(
    signal => checkPendingExternalSends({ client, wallets, updateExternalTransaction, signal }),
    [client, wallets, updateExternalTransaction]
  )
  // no send protocols => no SEND rows can exist (ExternalTransaction cascades
  // on wallet/protocol delete), so don't poll; check protocol existence, not
  // enabledness: disabled protocols can still reconcile existing sends
  const hasSendProtocols = !!wallets?.some(w => w.protocols?.some(p => p.send))
  usePollLoop(poll, { enabled: !!me && hasSendProtocols, name: 'external send check' })
}

export async function checkPendingExternalSends ({ client, wallets, updateExternalTransaction, signal }) {
  if (signal?.aborted) return

  const transactions = await fetchPendingExternalSends(client)

  // check concurrently like worker/externalTransactions.js: a slow/unreachable
  // provider only blocks its own check, so a poll cycle is bounded by one check
  // timeout instead of N of them. Concurrent same-hash checks ("send anyway"
  // duplicates) are safe: the server settles sends inside a serializable
  // transaction that keeps one SETTLED row per hash.
  await Promise.allSettled(
    transactions.map(transaction =>
      checkAndRecordExternalSend({
        transaction,
        protocol: findSendCheckProtocol(wallets, transaction),
        updateExternalTransaction,
        signal
      }).catch(err => {
        if (!isAbortLike(err)) console.warn('failed to check external send transaction:', err)
      })
    )
  )
}

async function fetchPendingExternalSends (client) {
  try {
    const { data, error } = await client.query({
      query: PENDING_EXTERNAL_SEND_TRANSACTIONS,
      fetchPolicy: 'network-only',
      errorPolicy: 'all'
    })
    if (error) throw error
    return data.pendingExternalSendTransactions ?? []
  } catch (err) {
    console.error('failed to fetch external sends to check:', err)
    return []
  }
}

// Resolve the saved send protocol, with the client checkPayment adapter attached.
function findSendCheckProtocol (wallets, transaction) {
  const wallet = wallets?.find(w => Number(w.id) === Number(transaction.walletId))
  // Disabled protocols can still reconcile existing sends.
  const protocol = wallet?.protocols?.find(p => p.send && Number(p.id) === Number(transaction.protocolId))
  return protocol ? withClientSendProtocol(protocol) : null
}

async function checkAndRecordExternalSend ({ transaction, protocol, updateExternalTransaction, signal }) {
  const stopped = externalTransactionCheckStopped(transaction)

  // Final rows (terminal, or stopped UNKNOWN) already carry their final diagnosis.
  if (externalTransactionFinal(transaction)) return
  // Active rows that this device cannot check may still be checked by another tab/device.
  if (!stopped && !protocol) return

  if (!protocolCanCheckPayment(protocol)) {
    // An active UNKNOWN row already carries a more specific diagnosis from the
    // inline send path (e.g. PROOF_UNAVAILABLE: "wallet reported settlement
    // without proof"); don't erase it with the generic VERIFICATION_UNSUPPORTED,
    // which is a stop reason and would make the overwrite permanent.
    if (transaction.settlementStatus === 'UNKNOWN') return
    // stopped → gave-up UNKNOWN; active → VERIFICATION_UNSUPPORTED
    const change = classifyExternalTransactionCheck(transaction, { canCheck: false, stopped })
    await recordExternalSendCheckIfChanged(
      updateExternalTransaction,
      transaction,
      change,
      signal
    )
    return
  }

  let result
  let err
  try {
    result = await withTimeoutSignal(WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS, s =>
      protocol.checkPayment({ hash: transaction.hash }, protocol.config, { signal: s }), { parentSignal: signal })
  } catch (e) {
    // Classify errors including our own check timeout; only parent-signal
    // aborts (teardown) are exempt, via the guard below.
    err = e
  }

  // Poller was torn down while the check was in flight.
  if (signal?.aborted) return

  const change = classifyExternalTransactionCheck(transaction, {
    result,
    error: err,
    stopped
  })
  await recordExternalSendCheckIfChanged(updateExternalTransaction, transaction, change, signal)
}

async function recordExternalSendCheckIfChanged (updateExternalTransaction, transaction, change, signal) {
  if (signal?.aborted) return
  if (externalSendCheckNoop(transaction, change)) return

  await updateExternalTransaction({
    variables: {
      input: {
        id: transaction.id,
        ...change
      }
    }
  })
}

function externalSendCheckNoop (transaction, change) {
  return Object.keys(change).every(key =>
    ['settlementStatus', 'error', 'unknownReason'].includes(key) &&
    externalSendCheckValueEqual(transaction[key], change[key]))
}

function externalSendCheckValueEqual (current, next) {
  if (next === undefined) return true
  return (current ?? null) === (next ?? null)
}
