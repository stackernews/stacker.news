import { useWallets, useLoading } from '@/wallets/client/context'

export function useWalletIndicator () {
  const wallets = useWallets()
  const loading = useLoading()
  return !loading && wallets.length === 0
}
