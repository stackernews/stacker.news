import { useWallets } from '@/wallets/client/context'
import protocols from '@/wallets/client/protocols'

export function useWallet (name) {
  // TODO(wallet-v2): implement this
}

export function useConfiguredWallets () {
  // TODO(wallet-v2): implement this
}

export function useSendWallets () {
  const wallets = useWallets()
  return wallets.filter(w => w.__typename === 'UserWallet' && w.send && w.enabled)
}

export function useSendProtocols () {
  const wallets = useSendWallets()
  return wallets.reduce((acc, wallet) => {
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
}

export function useWalletSupport (wallet) {
  const template = wallet.__typename === 'UserWallet' ? wallet.template : wallet
  return {
    receive: template.receive,
    send: template.send
  }
}

export function useWalletIsConfigured (wallet) {
  return wallet.__typename === 'UserWallet' && (wallet.receive || wallet.send)
}

export const WalletStatus = {
  Enabled: 'Enabled',
  Disabled: 'Disabled',
  Error: 'Error',
  Warning: 'Warning'
}

export function useWalletStatus (wallet) {
  if (wallet.__typename === 'WalletTemplate') return WalletStatus.Disabled

  // TODO(wallet-v2): once API returns wallet status, use it here
  return {
    send: wallet.send ? WalletStatus.Enabled : WalletStatus.Disabled,
    receive: wallet.receive ? WalletStatus.Enabled : WalletStatus.Disabled
  }
}
