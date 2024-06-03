import { useCallback } from 'react'
import { useMe } from '@/components/me'
import useLocalState from '@/components/use-local-state'
import { useWalletLogger } from '@/components/logger'
import { SSR } from '@/lib/constants'

// wallet definitions
export const WALLET_DEFS = [
  await import('@/components/wallet/lnbits')
]

export const Status = {
  Initialized: 'Initialized',
  Enabled: 'Enabled',
  Locked: 'Locked',
  Error: 'Error'
}

export function useWallet (name) {
  const me = useMe()
  const { logger } = useWalletLogger(name)

  const wallet = getWalletByName(name, me)
  const storageKey = getStorageKey(wallet?.name, me)
  const [config, saveConfig, clearConfig] = useLocalState(storageKey)

  const isConfigured = !!config

  const sendPayment = useCallback(async (bolt11) => {
    return await wallet.sendPayment({ bolt11, config, logger })
  }, [wallet, config, logger])

  const validate = useCallback(async (values) => {
    return await wallet.validate({ logger, ...values })
  }, [logger])

  const enable = useCallback(() => {
    enableWallet(name, me)
  }, [name, me])

  return {
    ...wallet,
    sendPayment,
    validate,
    config,
    saveConfig,
    clearConfig,
    enable,
    isConfigured,
    status: config?.enabled ? Status.Enabled : Status.Initialized
  }
}

export function getWalletByName (name, me) {
  return name
    ? WALLET_DEFS.find(def => def.name === name)
    : WALLET_DEFS.find(def => {
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
  for (const walletDef of WALLET_DEFS) {
    const toEnable = walletDef.name === name
    const key = getStorageKey(name, me)
    const config = JSON.parse(window.localStorage.getItem(key))
    if (config.enabled || toEnable) {
      config.enabled = toEnable
      window.localStorage.setItem(key, JSON.stringify(config))
    }
  }
}
