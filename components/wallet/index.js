import { useCallback } from 'react'
import { useMe } from '@/components/me'
import useLocalConfig from '@/components/use-local-state'
import { useWalletLogger } from '@/components/wallet-logger'
import { SSR } from '@/lib/constants'
import { bolt11Tags } from '@/lib/bolt11'

import * as lnbits from '@/components/wallet/lnbits'
import * as nwc from '@/components/wallet/nwc'
import * as lnc from '@/components/wallet/lnc'
import * as lnd from '@/components/wallet/lnd'
import { useApolloClient, useQuery } from '@apollo/client'
import { REMOVE_WALLET, WALLET_BY_TYPE } from '@/fragments/wallet'
import { autowithdrawInitial } from '../autowithdraw-shared'

// wallet definitions
export const WALLET_DEFS = [lnbits, nwc, lnc, lnd]

export const Status = {
  Initialized: 'Initialized',
  Enabled: 'Enabled',
  Locked: 'Locked',
  Error: 'Error'
}

export function useWallet (name) {
  const me = useMe()

  const wallet = name ? getWalletByName(name) : getEnabledWallet(me)
  const { logger } = useWalletLogger(wallet)

  const [config, saveConfig, clearConfig] = useConfig(wallet)
  const _isConfigured = isConfigured({ ...wallet, config })

  const status = (config?.enabled || config?.priority) ? Status.Enabled : Status.Initialized
  const enabled = status === Status.Enabled
  const priority = config?.priority

  const sendPayment = useCallback(async (bolt11) => {
    const hash = bolt11Tags(bolt11).payment_hash
    logger.info('sending payment:', `payment_hash=${hash}`)
    try {
      const { preimage } = await wallet.sendPayment({ bolt11, ...config, logger })
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

  const setPriority = useCallback(async (priority) => {
    if (_isConfigured && priority !== config.priority) {
      await saveConfig({ ...config, priority })
    }
  }, [wallet, config, logger])

  const save = useCallback(async (newConfig) => {
    try {
      // validate should log custom INFO and OK message
      // validate is optional since validation might happen during save on server
      // TODO: add timeout
      await wallet.validate?.({ me, logger, ...newConfig })
      await saveConfig(newConfig)
      logger.ok(_isConfigured ? 'wallet updated' : 'wallet attached')
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error('failed to attach: ' + message)
      throw err
    }
  }, [_isConfigured, saveConfig, me, logger])

  // delete is a reserved keyword
  const delete_ = useCallback(() => {
    try {
      clearConfig()
      logger.ok('wallet detached')
      disable()
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error(message)
      throw err
    }
  }, [clearConfig, logger, disable])

  return {
    ...wallet,
    sendPayment,
    config,
    save,
    delete: delete_,
    enable,
    disable,
    setPriority,
    isConfigured: _isConfigured,
    status,
    enabled,
    priority,
    logger
  }
}

function useConfig (wallet) {
  const me = useMe()

  const storageKey = getStorageKey(wallet?.name, me)
  const [localConfig, setLocalConfig, clearLocalConfig] = useLocalConfig(storageKey)

  const [serverConfig, setServerConfig, clearServerConfig] = useServerConfig(wallet)

  const hasLocalConfig = !!wallet?.sendPayment
  const hasServerConfig = !!wallet?.server

  const config = {
    // only include config if it makes sense for this wallet
    // since server config always returns default values for autowithdraw settings
    // which might be confusing to have for wallets that don't support autowithdraw
    ...(hasLocalConfig ? localConfig : {}),
    ...(hasServerConfig ? serverConfig : {})
  }

  const saveConfig = useCallback(async (config) => {
    if (hasLocalConfig) setLocalConfig(config)
    if (hasServerConfig) await setServerConfig(config)
  }, [wallet])

  const clearConfig = useCallback(async () => {
    if (hasLocalConfig) clearLocalConfig()
    if (hasServerConfig) await clearServerConfig()
  }, [wallet])

  return [config, saveConfig, clearConfig]
}

function isConfigured ({ fields, config }) {
  if (!config || !fields) return false

  // a wallet is configured if all of it's required fields are set
  const val = fields.every(field => {
    return field.optional ? true : !!config?.[field.name]
  })

  return val
}

function useServerConfig (wallet) {
  const client = useApolloClient()
  const me = useMe()

  const { data, refetch: refetchConfig } = useQuery(WALLET_BY_TYPE, { variables: { type: wallet?.server?.walletType }, skip: !wallet?.server })

  const walletId = data?.walletByType?.id
  const serverConfig = { id: walletId, priority: data?.walletByType?.priority, ...data?.walletByType?.wallet }
  const autowithdrawSettings = autowithdrawInitial({ me, priority: serverConfig?.priority })
  const config = { ...serverConfig, ...autowithdrawSettings }

  const saveConfig = useCallback(async ({
    autoWithdrawThreshold,
    autoWithdrawMaxFeePercent,
    priority,
    ...config
  }) => {
    try {
      return await client.mutate({
        mutation: wallet.server.mutation,
        variables: {
          id: walletId,
          ...config,
          settings: {
            autoWithdrawThreshold: Number(autoWithdrawThreshold),
            autoWithdrawMaxFeePercent: Number(autoWithdrawMaxFeePercent),
            priority: !!priority
          }
        }
      })
    } finally {
      client.refetchQueries({ include: ['WalletLogs'] })
      refetchConfig()
    }
  }, [client, walletId])

  const clearConfig = useCallback(async () => {
    try {
      await client.mutate({
        mutation: REMOVE_WALLET,
        variables: { id: walletId }
      })
    } finally {
      client.refetchQueries({ include: ['WalletLogs'] })
      refetchConfig()
    }
  }, [client, walletId])

  return [config, saveConfig, clearConfig]
}

export function getWalletByName (name) {
  return WALLET_DEFS.find(def => def.name === name)
}

export function getServerWallet (type) {
  return WALLET_DEFS.find(def => def.server?.walletType === type)
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

export function useWallets () {
  return WALLET_DEFS.map(def => useWallet(def.name))
}

function getStorageKey (name, me) {
  let storageKey = `wallet:${name}`
  if (me) {
    storageKey = `${storageKey}:${me.id}`
  }
  return storageKey
}

function enableWallet (name, me) {
  const key = getStorageKey(name, me)
  const config = JSON.parse(window.localStorage.getItem(key))
  if (!config) return
  config.enabled = true
  window.localStorage.setItem(key, JSON.stringify(config))
}

function disableWallet (name, me) {
  const key = getStorageKey(name, me)
  const config = JSON.parse(window.localStorage.getItem(key))
  if (!config) return
  config.enabled = false
  window.localStorage.setItem(key, JSON.stringify(config))
}
