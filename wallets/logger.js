import { useCallback } from 'react'
import { decode as bolt11Decode } from 'bolt11'
import { formatMsats } from '@/lib/format'
import { walletTag } from '@/wallets/common'
import { useWalletLogManager } from '@/components/wallet-logger'

export function useWalletLoggerFactory () {
  const { appendLog } = useWalletLogManager()

  const log = useCallback((wallet, level) => (message, context = {}) => {
    if (!wallet) {
      return
    }

    if (context?.bolt11) {
    // automatically populate context from bolt11 to avoid duplicating this code
      const decoded = bolt11Decode(context.bolt11)
      context = {
        ...context,
        amount: formatMsats(decoded.millisatoshis),
        payment_hash: decoded.tagsObject.payment_hash,
        description: decoded.tagsObject.description,
        created_at: new Date(decoded.timestamp * 1000).toISOString(),
        expires_at: new Date(decoded.timeExpireDate * 1000).toISOString(),
        // payments should affect wallet status
        status: true
      }
    }
    context.send = true

    appendLog(wallet, level, message, context)
    console[level !== 'error' ? 'info' : 'error'](`[${walletTag(wallet.def)}]`, message)
  }, [appendLog])

  return useCallback(wallet => ({
    ok: (message, context) => log(wallet, 'ok')(message, context),
    info: (message, context) => log(wallet, 'info')(message, context),
    error: (message, context) => log(wallet, 'error')(message, context)
  }), [log])
}

export function useWalletLogger (wallet) {
  const factory = useWalletLoggerFactory()
  return factory(wallet)
}
