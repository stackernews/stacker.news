import { canReceive, canSend, isConfigured } from '@/wallets/common'
import { useWalletLogs } from '@/wallets/logger'
import styles from '@/styles/wallet.module.css'

export const Status = {
  Enabled: 'Enabled',
  Disabled: 'Disabled',
  Error: 'Error',
  Warning: 'Warning'
}

// TODO(wallet-v2): this will probably need an update
export function useWalletStatus (wallet) {
  const { logs } = useWalletLogs(wallet)

  return statusFromLogs(wallet, {
    any: wallet.config?.enabled && isConfigured(wallet) ? Status.Enabled : Status.Disabled,
    send: wallet.config?.enabled && canSend(wallet) ? Status.Enabled : Status.Disabled,
    recv: wallet.config?.enabled && canReceive(wallet) ? Status.Enabled : Status.Disabled
  }, logs)
}

const statusFromLogs = (wallet, status, logs) => {
  if (status.any === Status.Disabled) return status

  // override status depending on if there have been warnings or errors in the logs recently
  // find first log from which we can derive status (logs are sorted by recent first)
  const walletLogs = logs.filter(l => l.wallet === wallet.def.name)
  const sendLevel = walletLogs.find(l => l.context?.status && l.context?.send)?.level
  const recvLevel = walletLogs.find(l => l.context?.status && l.context?.recv)?.level

  const levelToStatus = (level) => {
    switch (level?.toLowerCase()) {
      case 'ok':
      case 'success': return Status.Enabled
      case 'error': return Status.Error
      case 'warn': return Status.Warning
    }
  }

  return {
    any: status.any,
    send: levelToStatus(sendLevel) || status.send,
    recv: levelToStatus(recvLevel) || status.recv
  }
}

export const statusToClass = status => {
  switch (status) {
    case Status.Enabled: return styles.success
    case Status.Disabled: return styles.disabled
    case Status.Error: return styles.error
    case Status.Warning: return styles.warning
  }
}
