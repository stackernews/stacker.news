import { useMe } from '@/components/me'
import { useWallets, useWalletsLoading } from '@/wallets/client/hooks/global'
import protocols from '@/wallets/client/protocols'
import { isWallet } from '@/wallets/lib/util'
import { useMemo } from 'react'

export function useSendProtocols () {
  const wallets = useWallets()
  const walletsLoading = useWalletsLoading()
  return useMemo(
    () => {
      if (walletsLoading) return []

      return wallets
        .filter(w => w.send)
        .reduce((acc, wallet) => {
          const configuredSendProtocols = wallet.protocols.filter(p => p.send && p.enabled)
          const configuredByName = new Map(configuredSendProtocols.map(protocol => [protocol.name, protocol]))
          // Match the protocol order users see in the wallet form when picking a default sender.
          const templateOrderedProtocols = (wallet.template?.protocols || [])
            .filter(protocol => protocol.send)
            .map(protocol => configuredByName.get(protocol.name))
            .filter(Boolean)
          const remainingProtocols = configuredSendProtocols
            .filter(protocol => !templateOrderedProtocols.some(ordered => ordered.id === protocol.id))

          return [
            ...acc,
            ...[...templateOrderedProtocols, ...remainingProtocols]
              .map(walletProtocol => {
                const { sendPayment } = protocols.find(p => p.name === walletProtocol.name)
                return {
                  ...walletProtocol,
                  sendPayment
                }
              })
          ]
        }, [])
    }
    , [wallets, walletsLoading])
}

export function useHasSendWallet () {
  const protocols = useSendProtocols()
  return useMemo(() => protocols.length > 0, [protocols])
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

export function useWalletStatus (wallet) {
  if (!isWallet(wallet)) return WalletStatus.DISABLED

  return useMemo(() => ({ send: wallet.send, receive: wallet.receive }), [wallet])
}

export function useWalletsUpdatedAt () {
  const { me } = useMe()
  return me?.privates?.walletsUpdatedAt
}

export function useProtocolTemplates (wallet) {
  return useMemo(() => {
    return isWallet(wallet) ? wallet.template.protocols : wallet.protocols
  }, [wallet])
}
