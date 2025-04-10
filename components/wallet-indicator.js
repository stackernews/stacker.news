import { useConfiguredWallets } from '@/wallets'

export function useWalletIndicator () {
  const { wallets, loading } = useConfiguredWallets()
  return !loading && wallets.length === 0
}
