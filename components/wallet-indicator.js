import { useConfiguredWallets } from '@/wallets'

export function useWalletIndicator () {
  const wallets = useConfiguredWallets()
  return wallets.length === 0
}
