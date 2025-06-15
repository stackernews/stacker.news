import { useWallets } from '@/wallets/client/context'
import protocols from '@/wallets/client/protocols'
import { isWallet } from '@/wallets/lib/util'
import { useMemo } from 'react'

export function useWallet (name) {
  // TODO(wallet-v2): implement this
}

export function useConfiguredWallets () {
  const wallets = useWallets()
  return useMemo(
    () => wallets.filter(w => isWallet(w)),
    [wallets]
  )
}

export function useSendWallets () {
  const wallets = useConfiguredWallets()
  return useMemo(
    () => wallets.filter(w => isWallet(w) && w.send && w.enabled),
    [wallets]
  )
}

export function useSendProtocols () {
  const wallets = useSendWallets()
  return useMemo(
    () => wallets.reduce((acc, wallet) => {
      return [
        ...acc,
        ...wallet.protocols
          .filter(p => p.send)
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

export function useWalletSupport (wallet) {
  const template = isWallet(wallet) ? wallet.template : wallet
  return useMemo(
    () => ({
      receive: template.receive,
      send: template.send
    }),
    [template]
  )
}

export function useWalletIsConfigured (wallet) {
  return isWallet(wallet) && (wallet.receive || wallet.send)
}

export const WalletStatus = {
  Enabled: 'Enabled',
  Disabled: 'Disabled',
  Error: 'Error',
  Warning: 'Warning'
}

export function useWalletStatus (wallet) {
  if (!isWallet(wallet)) return WalletStatus.Disabled

  // TODO(wallet-v2): once API returns wallet status, use it here
  return useMemo(
    () => ({
      send: wallet.send ? WalletStatus.Enabled : WalletStatus.Disabled,
      receive: wallet.receive ? WalletStatus.Enabled : WalletStatus.Disabled
    }),
    [wallet]
  )
}
