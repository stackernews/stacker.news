import { useMe } from '@/components/me'
import { useWallets } from '@/wallets/client/context'
import protocols from '@/wallets/client/protocols'
import { isWallet } from '@/wallets/lib/util'
import { useMemo } from 'react'

export function useSendProtocols () {
  const wallets = useWallets()
  return useMemo(
    () => wallets
      .filter(w => w.send)
      .reduce((acc, wallet) => {
        return [
          ...acc,
          ...wallet.protocols
            .filter(p => p.send && p.enabled)
            .map(walletProtocol => {
              const { sendPayment } = protocols.find(p => p.name === walletProtocol.name)
              return {
                ...walletProtocol,
                sendPayment
              }
            })
        ]
      }, [])
    , [wallets])
}

export function useHasSendWallet () {
  const protocols = useSendProtocols()
  return useMemo(() => protocols.length > 0, [protocols])
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
