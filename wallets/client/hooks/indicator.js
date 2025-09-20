import { useWallets, useWalletsLoading } from '@/wallets/client/hooks/global'

export function useWalletIndicator () {
  const wallets = useWallets()
  const loading = useWalletsLoading()
  return !loading && wallets.length === 0
}
