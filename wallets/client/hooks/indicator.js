import { useWallets, useWalletsSettled } from '@/wallets/client/hooks/global'

export function useWalletIndicator () {
  const wallets = useWallets()
  const walletsSettled = useWalletsSettled()
  return walletsSettled && wallets.length === 0
}
