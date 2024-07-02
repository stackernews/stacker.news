import { useCallback } from 'react'
import { useMe } from '@/components/me'
import useLocalState from '@/components/use-local-state'
import { useWalletLogger } from '@/components/wallet-logger'
import { SSR } from '@/lib/constants'
import { bolt11Tags } from '@/lib/bolt11'

import * as lnbits from '@/components/wallet/lnbits'
import * as nwc from '@/components/wallet/nwc'
import * as lnc from '@/components/wallet/lnc'
import * as lnd from '@/components/wallet/lnd'
import { useApolloClient, useMutation, useQuery } from '@apollo/client'
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

  // FIXME: This throws 'TypeError: Cannot read properties of undefined (reading 'length')' when I disable LNbits
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

  const save = useCallback(async (config) => {
    try {
      // validate should log custom INFO and OK message
      // validate is optional since validation might happen during save on server
      // TODO: add timeout
      await wallet.validate?.({ me, logger, ...config })
      await saveConfig(config)
      logger.ok('wallet attached')
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error(message)
      throw err
    }
  }, [saveConfig, me, logger])

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
    status: config?.enabled || config?.priority ? Status.Enabled : Status.Initialized,
    logger
  }
}

function useConfig (wallet) {
  if (!wallet) return []

  if (wallet.sendPayment) {
    // FIXME: this throws 'Error: Should have a queue' when I enable LNbits
    //   probably because of conditional hooks?
    return useLocalConfig(wallet)
  }

  if (wallet.server) {
    return useServerConfig(wallet)
  }

  // TODO: if wallets can do both return a merged version that knows which field goes where
  return []
}

function useLocalConfig (wallet) {
  const me = useMe()
  const storageKey = getStorageKey(wallet?.name, me)
  return useLocalState(storageKey)
}

function useServerConfig (wallet) {
  const client = useApolloClient()
  const me = useMe()

  const { walletType, mutation } = wallet.server

  const { data } = useQuery(WALLET_BY_TYPE, { variables: { type: walletType } })

  const [upsertWallet] = useMutation(mutation, {
    refetchQueries: ['WalletLogs'],
    onError: (err) => {
      client.refetchQueries({ include: ['WalletLogs'] })
      throw err
    }
  })

  const [removeWallet] = useMutation(REMOVE_WALLET, {
    refetchQueries: ['WalletLogs'],
    onError: (err) => {
      client.refetchQueries({ include: ['WalletLogs'] })
      throw err
    }
  })

  const walletId = data?.walletByType?.id
  const serverConfig = { id: walletId, priority: data?.walletByType?.priority, ...data?.walletByType?.wallet }
  const autowithdrawSettings = autowithdrawInitial({ me, priority: serverConfig?.priority })
  const config = { ...serverConfig, autowithdrawSettings }

  const saveConfig = useCallback(async ({
    autoWithdrawThreshold,
    autoWithdrawMaxFeePercent,
    priority,
    ...config
  }) => {
    await upsertWallet({
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
  }, [upsertWallet, walletId])

  const clearConfig = useCallback(async () => {
    await removeWallet({ variables: { id: config?.id } })
  }, [removeWallet, config?.id])

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
