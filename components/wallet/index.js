import { useCallback } from 'react'
import { useMe } from '@/components/me'
import useLocalState from '@/components/use-local-state'
import { useWalletLogger } from '@/components/wallet-logger'
import { SSR } from '@/lib/constants'
import { bolt11Tags } from '@/lib/bolt11'

// wallet definitions
export const WALLET_DEFS = [
  await import('@/components/wallet/lnbits'),
  await import('@/components/wallet/nwc')
]

export const Status = {
  Initialized: 'Initialized',
  Enabled: 'Enabled',
  Locked: 'Locked',
  Error: 'Error'
}

export function useWallet (name) {
  const me = useMe()

  const wallet = name ? getWalletByName(name, me) : getEnabledWallet(me)
  const { logger } = useWalletLogger(wallet)
  const storageKey = getStorageKey(wallet?.name, me)
  const [config, saveConfig, clearConfig] = useLocalState(storageKey)

  const sendPayment = useCallback(async (bolt11) => {
    const hash = bolt11Tags(bolt11).payment_hash
    logger.info('sending payment:', `payment_hash=${hash}`)
    try {
      const { preimage } = await wallet.sendPayment({ bolt11, config, logger })
      logger.ok('payment successful:', `payment_hash=${hash}`, `preimage=${preimage}`)
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error('payment failed:', `payment_hash=${hash}`, message)
      throw err
    }
  }, [wallet, config, logger])

  const enable = useCallback(() => {
    enableWallet(name, me)
    logger.ok('wallet enabled')
  }, [name, me, logger])

  const disable = useCallback(() => {
    disableWallet(name, me)
    logger.info('wallet disabled')
  }, [name, me, logger])

  const save = useCallback(async (values) => {
    try {
      // validate should log custom INFO and OK message
      // TODO: add timeout
      await wallet.validate({ logger, ...values })
      saveConfig(values)
      logger.ok('wallet attached')
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error(message)
      throw err
    }
  }, [saveConfig, logger])

  // delete is a reserved keyword
  const delete_ = useCallback(() => {
    try {
      clearConfig()
      logger.ok('wallet detached')
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error(message)
      throw err
    }
  }, [clearConfig, logger])

  return {
    ...wallet,
    sendPayment,
    config,
    save,
    delete: delete_,
    enable,
    disable,
    isConfigured: !!config,
    status: config?.enabled ? Status.Enabled : Status.Initialized,
    canPay: !!wallet?.sendPayment,
    canReceive: !!wallet?.createInvoice,
    logger
  }
}

export function getWalletByName (name, me) {
  return WALLET_DEFS.find(def => def.name === name)
}

export function getEnabledWallet (me) {
  // TODO: handle multiple enabled wallets
  return WALLET_DEFS
    .filter(def => !!def.sendPayment)
    .find(def => {
      const key = getStorageKey(def.name, me)
      const config = SSR ? null : JSON.parse(window?.localStorage.getItem(key))
      return config?.enabled
    })
}

function getStorageKey (name, me) {
  let storageKey = `wallet:${name}`
  if (me) {
    storageKey = `${storageKey}:${me.id}`
  }
  return storageKey
}

function enableWallet (name, me) {
  // mark all wallets as disabled except the one to enable
  for (const walletDef of WALLET_DEFS) {
    const key = getStorageKey(walletDef.name, me)
    let config = JSON.parse(window.localStorage.getItem(key))
    const toEnable = walletDef.name === name
    if (config || toEnable) {
      config = { ...config, enabled: toEnable }
      window.localStorage.setItem(key, JSON.stringify(config))
    }
  }
}

function disableWallet (name, me) {
  const key = getStorageKey(name, me)
  const config = JSON.parse(window.localStorage.getItem(key))
  if (!config) return
  config.enabled = false
  window.localStorage.setItem(key, JSON.stringify(config))
}
