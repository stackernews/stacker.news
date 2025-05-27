export function useWallet (name) {
  // TODO(wallet-v2): implement this
}

export function useConfiguredWallets () {
  // TODO(wallet-v2): implement this
}

export function useSendWallets () {
  // TODO(wallet-v2): implement this
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
