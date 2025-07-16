import { useWallets, useWalletsLoading } from '@/wallets/client/context'

export function useWalletIndicator () {
  const wallets = useWallets()
  const loading = useWalletsLoading()
  return !loading && wallets.length === 0
}
