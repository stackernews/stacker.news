import { useEffect, useMemo, useState } from 'react'
import protocols from '@/wallets/client/protocols'
import { WalletBalanceProbeSkipped, WalletPermissionsError, WalletValidationError } from '@/wallets/client/errors'
import { isWallet, orderedSendProtocols } from '@/wallets/lib/util'
import {
  peekCachedWalletBalance,
  readCachedWalletBalance
} from './cache'
import { balanceDisplay } from './format'
import { isAbortLike } from '@/lib/time'

const unavailableBalanceState = { status: 'unavailable', amount: null, display: null, error: null }
const loadingBalanceState = { status: 'loading', amount: null, display: null, error: null }
const permanentErrorStatuses = new Set([401, 403, 404])
const balanceReadersByProtocolName = new Map(
  protocols
    .filter(protocol => protocol.getBalance)
    .map(protocol => [protocol.name, protocol.getBalance])
)

export function useExternalWalletBalance (wallet) {
  const balanceProtocol = useMemo(() => selectExternalBalanceProtocol(wallet), [wallet])
  const [state, setState] = useState(() =>
    balanceProtocol ? externalBalanceState(peekCachedWalletBalance(balanceProtocol)) : unavailableBalanceState)

  useEffect(() => {
    if (!balanceProtocol) {
      setState(unavailableBalanceState)
      return
    }

    let cancelled = false

    setState(externalBalanceState(peekCachedWalletBalance(balanceProtocol)))
    readCachedWalletBalance(balanceProtocol)
      .then(result => {
        if (cancelled) return
        setState(externalBalanceState(result))
      })
      .catch(err => {
        if (cancelled) return
        // A deliberately skipped probe (e.g. LNC busy with a send) is not a
        // wallet failure, but it is a terminal state for this render pass.
        if (err instanceof WalletBalanceProbeSkipped) {
          setState({ status: 'error', amount: null, display: null, error: 'busy' })
          return
        }
        if (!isAbortLike(err)) console.warn('failed to fetch wallet balance:', err)
        setState({ status: 'error', amount: null, display: null, error: classifyExternalBalanceError(err) })
      })

    return () => {
      cancelled = true
    }
  }, [balanceProtocol])

  return { ...state, source: balanceProtocol?.name ?? null }
}

function selectExternalBalanceProtocol (wallet) {
  if (!wallet?.__typename || !isWallet(wallet)) return null

  // This displays one source balance, not a sum across all send protocols.
  for (const configuredProtocol of orderedSendProtocols(wallet)) {
    const getBalance = balanceReadersByProtocolName.get(configuredProtocol.name)
    if (!getBalance) continue

    return {
      id: configuredProtocol.id,
      name: configuredProtocol.name,
      config: configuredProtocol.config,
      getBalance
    }
  }

  return null
}

function classifyExternalBalanceError (err) {
  if (
    err instanceof WalletPermissionsError ||
    err instanceof WalletValidationError ||
    permanentErrorStatuses.has(err?.status)
  ) {
    return 'permanent'
  }

  return 'temporary'
}

function externalBalanceState (result) {
  if (result === undefined) return loadingBalanceState
  if (result?.balance == null) return unavailableBalanceState
  const { amount, currency } = result.balance
  return { status: 'ready', amount, display: balanceDisplay({ currency }), error: null }
}
