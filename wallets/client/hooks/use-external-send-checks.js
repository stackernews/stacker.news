import { useApolloClient, useMutation } from '@apollo/client/react'
import { useEffect } from 'react'
import { useMe } from '@/components/me'
import { useWallets } from './global'
import { withClientSendProtocol } from './wallet'
import { REPORT_EXTERNAL_SEND_OBSERVATION } from '@/wallets/client/fragments'
import { PENDING_EXTERNAL_SEND_TRANSACTIONS } from '@/fragments/payIn'
import {
  NORMAL_POLL_INTERVAL_MS,
  WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS
} from '@/lib/constants'
import { isAbortLike, withTimeoutSignal } from '@/lib/time'
import { toExternalTransactionObservation } from '@/wallets/lib/external-transactions'

export function useExternalSendChecks () {
  const client = useApolloClient()
  const { me } = useMe()
  const wallets = useWallets()
  const [reportExternalSendObservation] = useMutation(REPORT_EXTERNAL_SEND_OBSERVATION)
  const userId = me?.id

  const hasSendWallet = !!wallets?.some(wallet =>
    wallet.protocols?.some(protocol => protocol.send))

  useEffect(() => {
    if (userId == null || !hasSendWallet) return

    let timeout
    const controller = new AbortController()
    const poll = async () => {
      try {
        await checkPendingExternalSends({
          client,
          wallets,
          reportExternalSendObservation,
          signal: controller.signal
        })
      } catch (err) {
        console.warn('external send check failed:', err)
      }
      if (!controller.signal.aborted) timeout = setTimeout(poll, NORMAL_POLL_INTERVAL_MS)
    }
    timeout = setTimeout(poll, NORMAL_POLL_INTERVAL_MS)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [client, hasSendWallet, reportExternalSendObservation, userId, wallets])
}

export async function checkPendingExternalSends ({
  client,
  wallets,
  reportExternalSendObservation,
  signal
}) {
  if (signal?.aborted) return

  const { data } = await client.query({
    query: PENDING_EXTERNAL_SEND_TRANSACTIONS,
    fetchPolicy: 'network-only'
  })
  const transactions = data?.pendingExternalSendTransactions ?? []

  await Promise.all(transactions.map(transaction =>
    checkAndReportExternalSend({
      transaction,
      protocol: findSendCheckProtocol(wallets, transaction),
      reportExternalSendObservation,
      signal
    }).catch(err => {
      if (!isAbortLike(err)) console.warn('failed to check external send transaction:', err)
    })
  ))
}

function findSendCheckProtocol (wallets, transaction) {
  const wallet = wallets?.find(wallet =>
    Number(wallet.id) === Number(transaction.walletId))
  const protocol = wallet?.protocols?.find(protocol =>
    protocol.send && Number(protocol.id) === Number(transaction.protocolId))
  return protocol ? withClientSendProtocol(protocol) : null
}

export async function checkAndReportExternalSend ({
  transaction,
  protocol,
  reportExternalSendObservation,
  signal
}) {
  if (signal?.aborted) return
  if (!protocol) return

  let result
  let checkError
  const canCheck = typeof protocol.checkPayment === 'function'
  if (canCheck) {
    try {
      result = await withTimeoutSignal(
        WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS,
        checkSignal => protocol.checkPayment(
          {
            hash: transaction.hash,
            bolt11: transaction.bolt11,
            providerRequestId: transaction.providerRequestId
          },
          protocol.config,
          { signal: checkSignal }
        ),
        { parentSignal: signal }
      )
    } catch (err) {
      checkError = err
    }
  }
  if (signal?.aborted) return

  const observation = toExternalTransactionObservation(result, {
    error: checkError,
    canCheck
  })
  if (observation.status === 'PENDING' && !observation.errorType) return

  await reportExternalSendObservation({
    variables: { input: { id: transaction.id, ...observation } }
  })
}
