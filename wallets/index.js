import { useCallback } from 'react'
import { useMe } from '@/components/me'
import useLocalConfig from '@/components/use-local-state'
import { useWalletLogger } from '@/components/wallet-logger'
import { SSR } from '@/lib/constants'
import { bolt11Tags } from '@/lib/bolt11'

import walletDefs from 'wallets/client'
import { gql, useApolloClient, useQuery } from '@apollo/client'
import { REMOVE_WALLET, WALLET_BY_TYPE } from '@/fragments/wallet'
import { autowithdrawInitial } from '@/components/autowithdraw-shared'
import { useShowModal } from '@/components/modal'
import { useToast } from '../components/toast'
import { generateResolverName } from '@/lib/wallet'

export const Status = {
  Initialized: 'Initialized',
  Enabled: 'Enabled',
  Locked: 'Locked',
  Error: 'Error'
}

export function useWallet (name) {
  const me = useMe()
  const showModal = useShowModal()
  const toaster = useToast()

  const wallet = name ? getWalletByName(name) : getEnabledWallet(me)
  const { logger, deleteLogs } = useWalletLogger(wallet)

  const [config, saveConfig, clearConfig] = useConfig(wallet)
  const hasConfig = wallet?.fields.length > 0
  const _isConfigured = isConfigured({ ...wallet, config })

  const status = config?.enabled ? Status.Enabled : Status.Initialized
  const enabled = status === Status.Enabled
  const priority = config?.priority

  const sendPayment = useCallback(async (bolt11) => {
    const hash = bolt11Tags(bolt11).payment_hash
    logger.info('sending payment:', `payment_hash=${hash}`)
    try {
      const { preimage } = await wallet.sendPayment(bolt11, config, { me, logger, status, showModal })
      logger.ok('payment successful:', `payment_hash=${hash}`, `preimage=${preimage}`)
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error('payment failed:', `payment_hash=${hash}`, message)
      throw err
    }
  }, [me, wallet, config, logger, status])

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
      try {
        await saveConfig({ ...config, priority })
      } catch (err) {
        toaster.danger(`failed to change priority of ${wallet.name} wallet: ${err.message}`)
      }
    }
  }, [wallet, config, logger, toaster])

  const save = useCallback(async (newConfig) => {
    try {
      // testConnectClient should log custom INFO and OK message
      // testConnectClient is optional since validation might happen during save on server
      // TODO: add timeout
      const validConfig = await wallet.testConnectClient?.(newConfig, { me, logger })
      await saveConfig(validConfig ?? newConfig)
      logger.ok(_isConfigured ? 'wallet updated' : 'wallet attached')
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error('failed to attach: ' + message)
      throw err
    }
  }, [_isConfigured, saveConfig, me, logger])

  // delete is a reserved keyword
  const delete_ = useCallback(async () => {
    try {
      await clearConfig()
      logger.ok('wallet detached')
      disable()
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error(message)
      throw err
    }
  }, [clearConfig, logger, disable])

  if (!wallet) return null

  return {
    ...wallet,
    sendPayment,
    config,
    save,
    delete: delete_,
    deleteLogs,
    enable,
    disable,
    setPriority,
    hasConfig,
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
  const hasServerConfig = !!wallet?.walletType

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

  // a wallet is configured if all of its required fields are set
  const val = fields.every(field => {
    return field.optional ? true : !!config?.[field.name]
  })

  return val
}

function useServerConfig (wallet) {
  const client = useApolloClient()
  const me = useMe()

  const { data, refetch: refetchConfig } = useQuery(WALLET_BY_TYPE, { variables: { type: wallet?.walletType }, skip: !wallet?.walletType })

  const walletId = data?.walletByType?.id
  const serverConfig = {
    id: walletId,
    priority: data?.walletByType?.priority,
    enabled: data?.walletByType?.enabled,
    ...data?.walletByType?.wallet
  }
  const autowithdrawSettings = autowithdrawInitial({ me })
  const config = { ...serverConfig, ...autowithdrawSettings }

  const saveConfig = useCallback(async ({
    autoWithdrawThreshold,
    autoWithdrawMaxFeePercent,
    priority,
    enabled,
    ...config
  }) => {
    try {
      const mutation = generateMutation(wallet)
      return await client.mutate({
        mutation,
        variables: {
          id: walletId,
          ...config,
          settings: {
            autoWithdrawThreshold: Number(autoWithdrawThreshold),
            autoWithdrawMaxFeePercent: Number(autoWithdrawMaxFeePercent),
            priority,
            enabled
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

function generateMutation (wallet) {
  const resolverName = generateResolverName(wallet.walletField)

  let headerArgs = '$id: ID, '
  headerArgs += wallet.fields.map(f => {
    let arg = `$${f.name}: String`
    if (!f.optional) {
      arg += '!'
    }
    return arg
  }).join(', ')
  headerArgs += ', $settings: AutowithdrawSettings!'

  let inputArgs = 'id: $id, '
  inputArgs += wallet.fields.map(f => `${f.name}: $${f.name}`).join(', ')
  inputArgs += ', settings: $settings'

  return gql`mutation ${resolverName}(${headerArgs}) {
    ${resolverName}(${inputArgs})
  }`
}

export function getWalletByName (name) {
  return walletDefs.find(def => def.name === name)
}

export function getWalletByType (type) {
  return walletDefs.find(def => def.walletType === type)
}

export function getEnabledWallet (me) {
  return walletDefs
    .filter(def => !!def.sendPayment)
    .map(def => {
      // populate definition with properties from useWallet that are required for sorting
      const key = getStorageKey(def.name, me)
      const config = SSR ? null : JSON.parse(window?.localStorage.getItem(key))
      const priority = config?.priority
      return { ...def, config, priority }
    })
    .filter(({ config }) => config?.enabled)
    .sort(walletPrioritySort)[0]
}

export function walletPrioritySort (w1, w2) {
  const delta = w1.priority - w2.priority
  // delta is NaN if either priority is undefined
  if (!Number.isNaN(delta) && delta !== 0) return delta

  // if one wallet has a priority but the other one doesn't, the one with the priority comes first
  if (w1.priority !== undefined && w2.priority === undefined) return -1
  if (w1.priority === undefined && w2.priority !== undefined) return 1

  // both wallets have no priority set, falling back to other methods

  // if both wallets have an id, use that as tie breaker
  // since that's the order in which autowithdrawals are attempted
  if (w1.config?.id && w2.config?.id) return Number(w1.config.id) - Number(w2.config.id)

  // else we will use the card title as tie breaker
  return w1.card.title < w2.card.title ? -1 : 1
}

export function useWallets () {
  const wallets = walletDefs.map(def => useWallet(def.name))

  const resetClient = useCallback(async (wallet) => {
    for (const w of wallets) {
      if (w.sendPayment) {
        await w.delete()
      }
      await w.deleteLogs()
    }
  }, [wallets])

  return { wallets, resetClient }
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
