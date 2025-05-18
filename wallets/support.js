import { supportsReceive, supportsSend } from '@/wallets/common'

// TODO(wallet-v2): this will probably need an update
export function useWalletSupport (wallet) {
  return {
    send: supportsSend(wallet),
    recv: supportsReceive(wallet)
  }
}
