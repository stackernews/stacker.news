import { supportsReceive, supportsSend } from '@/wallets/common'

export function useWalletSupport (wallet) {
  return {
    send: supportsSend(wallet),
    recv: supportsReceive(wallet)
  }
}
