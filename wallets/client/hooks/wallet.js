import { useMe } from '@/components/me'
import { useTemplates, useWalletSendReady, useWallets } from '@/wallets/client/hooks/global'
import protocols from '@/wallets/client/protocols'
import { isWallet, orderedSendProtocols, templatePathSegmentToName } from '@/wallets/lib/util'
import { useMemo } from 'react'
import { useRouter } from 'next/router'

export function useSendProtocols () {
  const wallets = useWallets()
  const walletSendReady = useWalletSendReady()
  return useMemo(
    () => {
      if (!walletSendReady) return []

      return wallets
        .filter(w => w.send)
        .reduce((acc, wallet) => {
          return [
            ...acc,
            ...orderedSendProtocols(wallet)
              .map(withClientSendProtocol)
          ]
        }, [])
    }
    , [wallets, walletSendReady])
}

export function useHasSendWallet () {
  const sendProtocolId = usePreferredSendProtocolId()
  return sendProtocolId !== undefined
}

export function usePreferredSendProtocolId () {
  const protocols = useSendProtocols()
  return useMemo(() => {
    if (!protocols[0]?.id) return undefined
    return Number(protocols[0].id)
  }, [protocols])
}

export function useWalletSupport (wallet) {
  const template = isWallet(wallet) ? wallet.template : wallet
  return useMemo(() => ({ receive: template.receive === WalletStatus.OK, send: template.send === WalletStatus.OK }), [template])
}

export const WalletStatus = {
  OK: 'OK',
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  DISABLED: 'DISABLED'
}

// Send/receive status from the wallet record; templates are DISABLED.
export function walletStatus (wallet) {
  if (!isWallet(wallet)) {
    return { send: WalletStatus.DISABLED, receive: WalletStatus.DISABLED }
  }

  return { send: wallet.send, receive: wallet.receive }
}

export function useWalletCapabilities (wallet) {
  const support = useWalletSupport(wallet)
  const sendProtocol = useMemo(() => {
    const walletProtocol = orderedSendProtocols(wallet)[0]
    return walletProtocol ? withClientSendProtocol(walletProtocol) : null
  }, [wallet])
  const receiveProtocol = useMemo(() => {
    return wallet.protocols.find(protocol => !protocol.send && protocol.enabled)
  }, [wallet.protocols])

  return useMemo(() => ({
    sendProtocol,
    receiveProtocol,
    hasConfiguredProtocols: wallet.protocols.length > 0,
    canSend: support.send && Boolean(sendProtocol),
    canReceive: support.receive && Boolean(receiveProtocol)
  }), [receiveProtocol, sendProtocol, support.receive, support.send, wallet.protocols.length])
}

export function withClientSendProtocol (walletProtocol) {
  const clientProtocol = protocols.find(protocol => protocol.name === walletProtocol.name)
  return {
    ...walletProtocol,
    sendPayment: clientProtocol?.sendPayment,
    checkPayment: clientProtocol?.checkPayment,
    enforcesMaxFee: clientProtocol?.enforcesMaxFee
  }
}

export function useWalletsUpdatedAt () {
  const { me } = useMe()
  return me?.privates?.walletsUpdatedAt
}

export function useRouteWallet () {
  const router = useRouter()
  const wallets = useWallets()
  const routeId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id
  const wallet = useMemo(() => {
    const id = Number(routeId)
    if (!Number.isSafeInteger(id)) return null
    return wallets.find(wallet => Number(wallet.id) === id) ?? null
  }, [routeId, wallets])

  return { wallet, ready: router.isReady, routeId }
}

export function useRouteTemplate () {
  const router = useRouter()
  const templates = useTemplates()
  const routeTemplate = router.query.template
  const template = useMemo(() => {
    if (!routeTemplate) return null
    const name = templatePathSegmentToName(routeTemplate)
    return templates.find(t => t.name === name) ?? null
  }, [routeTemplate, templates])

  return { template, ready: router.isReady, routeTemplate }
}
