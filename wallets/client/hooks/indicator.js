import { useWallets, useWalletSendReady } from '@/wallets/client/hooks/global'

export function useWalletIndicator () {
  const wallets = useWallets()
  const walletSendReady = useWalletSendReady()
  return walletSendReady && wallets.length === 0
}
