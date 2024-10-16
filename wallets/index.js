import { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react'
import { useMe } from '@/components/me'
import { openVault } from '@/components/use-vault'
import { useWalletLogger } from '@/components/wallet-logger'
import { bolt11Tags } from '@/lib/bolt11'

import walletDefs from 'wallets/client'
import { gql, useApolloClient, useMutation, useQuery } from '@apollo/client'
import { REMOVE_WALLET, WALLET_BY_TYPE, BEST_WALLETS } from '@/fragments/wallet'
import { autowithdrawInitial } from '@/components/autowithdraw-shared'
import { useShowModal } from '@/components/modal'
import { useToast } from '../components/toast'
import { generateResolverName, isConfigured, isClientField, isServerField } from '@/lib/wallet'
import { walletValidate } from '@/lib/validate'
import { SSR, FAST_POLL_INTERVAL as POLL_INTERVAL } from '@/lib/constants'

export const Status = {
  Initialized: 'Initialized',
  Enabled: 'Enabled',
  Locked: 'Locked',
  Error: 'Error'
}

const WalletContext = createContext({
  wallets: [],
  sendWallets: []
})

export function useWallet (name) {
  const context = useContext(WalletContext)
  const bestSendWalletList = context.sendWallets
  if (!name) {
    // find best wallet in list
    const highestWalletDef = bestSendWalletList?.map(w => getWalletByType(w.type))
      .filter(w => !w.isAvailable || w.isAvailable())
    name = highestWalletDef?.[0]?.name
  }
  const wallet = context.wallets.find(w => w.def.name === name)
  return wallet
}

function useWalletInner (name) {
  const { me } = useMe()
  const showModal = useShowModal()
  const toaster = useToast()
  const [disableFreebies] = useMutation(gql`mutation { disableFreebies }`)

  const walletDef = getWalletByName(name)

  const { logger, deleteLogs } = useWalletLogger(walletDef)
  const [config, saveConfig, clearConfig, refreshConfig] = useConfig(walletDef)
  const available = (!walletDef?.isAvailable || walletDef?.isAvailable())

  const status = config?.enabled && available && (config.canSend || config.canReceive) ? Status.Enabled : Status.Initialized
  const enabled = status === Status.Enabled
  const priority = config?.priority
  const hasConfig = walletDef?.fields?.length > 0
  const _isConfigured = useCallback(() => {
    return isConfigured({ ...walletDef, config })
  }, [walletDef, config])

  const enablePayments = useCallback((updatedConfig) => {
    saveConfig({ ...(updatedConfig || config), enabled: true }, { skipTests: true })
    logger.ok('payments enabled')
    disableFreebies().catch(console.error)
  }, [config])

  const disablePayments = useCallback((updatedConfig) => {
    saveConfig({ ...(updatedConfig || config), enabled: false }, { skipTests: true })
    logger.info('payments disabled')
  }, [config])

  const sendPayment = useCallback(async (bolt11) => {
    const hash = bolt11Tags(bolt11).payment_hash
    logger.info('sending payment:', `payment_hash=${hash}`)
    try {
      const preimage = await walletDef.sendPayment(bolt11, config, { me, logger, status, showModal })
      logger.ok('payment successful:', `payment_hash=${hash}`, `preimage=${preimage}`)
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error('payment failed:', `payment_hash=${hash}`, message)
      throw err
    }
  }, [me, walletDef, config])

  const setPriority = useCallback(async (priority) => {
    if (_isConfigured() && priority !== config.priority) {
      try {
        await saveConfig({ ...config, priority }, { logger, skipTests: true })
      } catch (err) {
        toaster.danger(`failed to change priority of ${walletDef.name} wallet: ${err.message}`)
      }
    }
  }, [walletDef, config])

  const save = useCallback(async (newConfig) => {
    await saveConfig(newConfig, { logger })
    const available = (!walletDef.isAvailable || walletDef.isAvailable())
    logger.ok(_isConfigured() ? 'payment details updated' : 'wallet attached for payments')
    if (newConfig.enabled && available) logger.ok('payments enabled')
    else logger.ok('payments disabled')
  }, [saveConfig, me])

  // delete is a reserved keyword
  const delete_ = useCallback(async (options) => {
    try {
      logger.ok('wallet detached for payments')
      await clearConfig({ logger, ...options })
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error(message)
      throw err
    }
  }, [clearConfig])

  const deleteLogs_ = useCallback(async (options) => {
    // first argument is to override the wallet
    return await deleteLogs(options)
  }, [deleteLogs])

  if (!walletDef) return null

  const wallet = { ...walletDef }

  wallet.isConfigured = _isConfigured()
  wallet.enablePayments = enablePayments
  wallet.disablePayments = disablePayments
  wallet.canSend = config.canSend && available
  wallet.canReceive = config.canReceive
  wallet.config = config
  wallet.save = save
  wallet.delete = delete_
  wallet.deleteLogs = deleteLogs_
  wallet.setPriority = setPriority
  wallet.hasConfig = hasConfig
  wallet.status = status
  wallet.enabled = enabled
  wallet.available = available
  wallet.priority = priority
  wallet.logger = logger
  wallet.sendPayment = sendPayment
  wallet.def = walletDef
  wallet.refresh = () => {
    return refreshConfig()
  }
  return wallet
}

function extractConfig (fields, config, client, includeMeta = true) {
  return Object.entries(config).reduce((acc, [key, value]) => {
    const field = fields.find(({ name }) => name === key)

    // filter server config which isn't specified as wallet fields
    // (we allow autowithdraw members to pass validation)
    if (client && key === 'id') return acc

    // field might not exist because config.enabled doesn't map to a wallet field
    if ((!field && includeMeta) || (field && (client ? isClientField(field) : isServerField(field)))) {
      return {
        ...acc,
        [key]: value
      }
    } else {
      return acc
    }
  }, {})
}

function extractClientConfig (fields, config) {
  return extractConfig(fields, config, true, false)
}

function extractServerConfig (fields, config) {
  return extractConfig(fields, config, false, true)
}

function useConfig (walletDef) {
  const client = useApolloClient()
  const { me } = useMe()
  const toaster = useToast()
  const autowithdrawSettings = autowithdrawInitial({ me })
  const clientVault = useRef(null)

  const [config, innerSetConfig] = useState({})
  const [currentWallet, innerSetCurrentWallet] = useState(null)

  const canSend = !!walletDef?.sendPayment
  const canReceive = !walletDef?.clientOnly

  const queryServerWallet = useCallback(async () => {
    const wallet = await client.query({
      query: WALLET_BY_TYPE,
      variables: { type: walletDef.walletType },
      fetchPolicy: 'network-only'
    })
    return wallet?.data?.walletByType
  }, [walletDef, client])

  const refreshConfig = useCallback(async () => {
    if (walletDef) {
      let newConfig = {}
      newConfig = {
        ...autowithdrawSettings
      }

      // fetch server config
      const serverConfig = await queryServerWallet()

      if (serverConfig) {
        newConfig = {
          ...newConfig,
          id: serverConfig.id,
          priority: serverConfig.priority,
          enabled: serverConfig.enabled
        }
        if (serverConfig.wallet) {
          newConfig = {
            ...newConfig,
            ...serverConfig.wallet
          }
        }
      }

      // fetch client config
      let clientConfig = {}
      if (serverConfig) {
        if (clientVault.current) clientVault.current.close()
        const newClientVault = openVault(client, me, serverConfig)
        clientVault.current = newClientVault
        clientConfig = await newClientVault.get(walletDef.name, {})
        if (clientConfig) {
          for (const [key, value] of Object.entries(clientConfig)) {
            if (newConfig[key] === undefined) {
              newConfig[key] = value
            } else {
              console.warn('Client config key', key, 'already exists in server config')
            }
          }
        }
      }

      if (newConfig.canSend == null) {
        newConfig.canSend = canSend && isConfigured({ fields: walletDef.fields, config: newConfig, clientOnly: true })
      }

      if (newConfig.canReceive == null) {
        newConfig.canReceive = canReceive && isConfigured({ fields: walletDef.fields, config: newConfig, serverOnly: true })
      }

      // console.log('Client config', clientConfig)
      // console.log('Server config', serverConfig)
      // console.log('Merged config', newConfig)

      // set merged config
      innerSetConfig(newConfig)

      // set wallet ref
      innerSetCurrentWallet(serverConfig)
    }
  }, [walletDef, me])

  useEffect(() => {
    refreshConfig()
  }, [walletDef, me])

  const saveConfig = useCallback(async (newConfig, { logger, skipTests }) => {
    const serverConfig = await queryServerWallet()
    const priorityOnly = skipTests
    try {
      // gather configs

      let newClientConfig = extractClientConfig(walletDef.fields, newConfig)
      try {
        const transformedConfig = await walletValidate(walletDef, newClientConfig)
        if (transformedConfig) {
          newClientConfig = Object.assign(newClientConfig, transformedConfig)
        }
      } catch (e) {
        newClientConfig = {}
      }

      let newServerConfig = extractServerConfig(walletDef.fields, newConfig)
      try {
        const transformedConfig = await walletValidate(walletDef, newServerConfig)
        if (transformedConfig) {
          newServerConfig = Object.assign(newServerConfig, transformedConfig)
        }
      } catch (e) {
        newServerConfig = {}
      }

      // check if it misses send or receive configs
      const isReadyToSend = canSend && isConfigured({ fields: walletDef.fields, config: newConfig, clientOnly: true })
      const isReadyToReceive = canReceive && isConfigured({ fields: walletDef.fields, config: newConfig, serverOnly: true })
      const { autoWithdrawThreshold, autoWithdrawMaxFeePercent, priority, enabled } = newConfig

      // console.log('New client config', newClientConfig)
      // console.log('New server config', newServerConfig)
      // console.log('Sender', isReadyToSend, 'Receiver', isReadyToReceive, 'enabled', enabled, autoWithdrawThreshold, autoWithdrawMaxFeePercent, priority)

      // client test
      if (!skipTests && isReadyToSend) {
        try {
        // XXX: testSendPayment can return a new config (e.g. lnc)
          const newerConfig = await walletDef.testSendPayment?.(newClientConfig, { me, logger })
          if (newerConfig) {
            newClientConfig = Object.assign(newClientConfig, newerConfig)
          }
        } catch (err) {
          logger.error(err.message)
          throw err
        }
      }

      // set server config (will create wallet if it doesn't exist) (it is also testing receive config)
      if (!isReadyToSend && !isReadyToReceive) throw new Error('wallet should be configured to send or receive payments')

      const mutation = generateMutation(walletDef)
      const variables = {
        ...newServerConfig,
        id: serverConfig?.id,
        settings: {
          autoWithdrawThreshold: Number(autoWithdrawThreshold == null ? autowithdrawSettings.autoWithdrawThreshold : autoWithdrawThreshold),
          autoWithdrawMaxFeePercent: Number(autoWithdrawMaxFeePercent == null ? autowithdrawSettings.autoWithdrawMaxFeePercent : autoWithdrawMaxFeePercent),
          priority,
          enabled
        },
        canSend: isReadyToSend,
        canReceive: isReadyToReceive,
        priorityOnly
      }
      const { data: mutationResult, errors: mutationErrors } = await client.mutate({
        mutation,
        variables
      })

      if (mutationErrors) {
        throw new Error(mutationErrors[0].message)
      }

      // grab and update wallet ref
      const newWallet = mutationResult[generateResolverName(walletDef.walletField)]
      innerSetCurrentWallet(newWallet)

      // set client config
      const writeVault = openVault(client, me, newWallet, {})
      try {
        await writeVault.set(walletDef.name, newClientConfig)
      } finally {
        await writeVault.close()
      }
    } finally {
      client.refetchQueries({ include: ['WalletLogs'] })
      await refreshConfig()
    }
  }, [config, currentWallet, canSend, canReceive])

  const clearConfig = useCallback(async ({ logger, clientOnly, ...options }) => {
    // only remove wallet if there is a wallet to remove
    if (!currentWallet?.id) return
    try {
      const clearVault = openVault(client, me, currentWallet, {})
      try {
        await clearVault.clear(walletDef?.name, { onlyFromLocalStorage: clientOnly })
      } catch (e) {
        toaster.danger(`failed to clear client config for ${walletDef.name}: ${e.message}`)
      } finally {
        await clearVault.close()
      }

      if (!clientOnly) {
        try {
          await client.mutate({
            mutation: REMOVE_WALLET,
            variables: { id: currentWallet.id }
          })
        } catch (e) {
          toaster.danger(`failed to remove wallet ${currentWallet.id}: ${e.message}`)
        }
      }
    } finally {
      client.refetchQueries({ include: ['WalletLogs'] })
      await refreshConfig()
    }
  }, [config, currentWallet])

  return [config, saveConfig, clearConfig, refreshConfig]
}

function generateMutation (wallet) {
  const resolverName = generateResolverName(wallet.walletField)

  let headerArgs = '$id: ID, '
  headerArgs += wallet.fields
    .filter(isServerField)
    .map(f => {
      const arg = `$${f.name}: String`
      // required fields are checked server-side
      // if (!f.optional) {
      //   arg += '!'
      // }
      return arg
    }).join(', ')
  headerArgs += ', $settings: AutowithdrawSettings!, $priorityOnly: Boolean, $canSend: Boolean!, $canReceive: Boolean!'

  let inputArgs = 'id: $id, '
  inputArgs += wallet.fields
    .filter(isServerField)
    .map(f => `${f.name}: $${f.name}`).join(', ')
  inputArgs += ', settings: $settings, priorityOnly: $priorityOnly, canSend: $canSend, canReceive: $canReceive,'

  return gql`mutation ${resolverName}(${headerArgs}) {
    ${resolverName}(${inputArgs}) {
      id,
      type,
      enabled,
      priority,
      canReceive,
      canSend
    }
  }`
}

export function getWalletByName (name) {
  return walletDefs.find(def => def.name === name)
}

export function getWalletByType (type) {
  return walletDefs.find(def => def.walletType === type)
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
  const { wallets } = useContext(WalletContext)
  const resetClient = useCallback(async (wallet) => {
    for (const w of wallets) {
      if (w.canSend) {
        await w.delete({ clientOnly: true, onlyFromLocalStorage: true })
      }
      await w.deleteLogs({ clientOnly: true })
    }
  }, [wallets])
  return { wallets, resetClient }
}

export function WalletProvider ({ children }) {
  const { me } = useMe()
  const migrationRan = useRef(false)
  const migratableKeys = !migrationRan.current && !SSR ? Object.keys(window.localStorage).filter(k => k.startsWith('wallet:')) : undefined

  const walletList = walletDefs.map(def => useWalletInner(def.name)).filter(w => w)
  const { data: bestWalletList } = useQuery(BEST_WALLETS, SSR
    ? {}
    : {
        pollInterval: POLL_INTERVAL,
        nextFetchPolicy: 'cache-and-network'
      })

  const processSendWallets = (bestWalletData) => {
    const clientSideSorting = false // sorting is now done on the server
    let wallets = (bestWalletData?.wallets ?? []).filter(w => w.canSend)
    if (clientSideSorting) wallets = wallets.sort(walletPrioritySort)
    return wallets
  }

  const wallets = walletList.sort(walletPrioritySort)
  const [bestSendWallets, innerSetBestSendWallets] = useState(() => processSendWallets(bestWalletList))

  useEffect(() => {
    innerSetBestSendWallets(processSendWallets(bestWalletList))
    for (const wallet of wallets) {
      wallet.refresh()
    }
  }, [bestWalletList])

  // migration
  useEffect(() => {
    if (SSR || !me?.id || !wallets.length) return
    if (migrationRan.current) return
    migrationRan.current = true
    if (!migratableKeys?.length) {
      console.log('wallet migrator: nothing to migrate', migratableKeys)
      return
    }
    const userId = me.id
    // List all local storage keys related to wallet settings
    const userKeys = migratableKeys.filter(k => k.endsWith(`:${userId}`))
    ;(async () => {
      for (const key of userKeys) {
        try {
          const walletType = key.substring('wallet:'.length, key.length - userId.length - 1)
          const walletConfig = JSON.parse(window.localStorage.getItem(key))
          const wallet = wallets.find(w => w.def.name === walletType)
          if (wallet) {
            console.log('Migrating', walletType, walletConfig)
            await wallet.save(walletConfig)
            window.localStorage.removeItem(key)
          } else {
            console.warn('No wallet found for', walletType, wallets)
          }
        } catch (e) {
          window.localStorage.removeItem(key)
          console.error('Failed to migrate wallet', key, e)
        }
      }
    })()
  }, [])

  return (
    <WalletContext.Provider value={{ wallets, sendWallets: bestSendWallets }}>
      {children}
    </WalletContext.Provider>
  )
}
