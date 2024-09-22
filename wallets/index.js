import { useCallback } from 'react'
import { useMe } from '@/components/me'
import useVaultStorageState from '@/components/use-user-vault-state'
import { useWalletLogger } from '@/components/wallet-logger'
import { bolt11Tags } from '@/lib/bolt11'

import walletDefs from 'wallets/client'
import { gql, useApolloClient, useMutation, useQuery } from '@apollo/client'
import { REMOVE_WALLET, WALLET_BY_TYPE } from '@/fragments/wallet'
import { autowithdrawInitial } from '@/components/autowithdraw-shared'
import { useShowModal } from '@/components/modal'
import { useToast } from '../components/toast'
import { generateResolverName } from '@/lib/wallet'
import { walletValidate } from '@/lib/validate'

export const Status = {
  Initialized: 'Initialized',
  Enabled: 'Enabled',
  Locked: 'Locked',
  Error: 'Error'
}

export function useWallet (name) {
  if (!name) {
    const defaultWallet = walletDefs
      .filter(def => !!def.sendPayment && !!def.name)
      .map(def => {
        const w = useWallet(def.name)
        return w
      })
      .filter((wallet) => {
        return wallet?.enabled
      })
      .sort(walletPrioritySort)[0]
    return defaultWallet
  }

  const { me } = useMe()
  const showModal = useShowModal()
  const toaster = useToast()
  const [disableFreebies] = useMutation(gql`mutation { disableFreebies }`)

  const wallet = getWalletByName(name)
  const { logger, deleteLogs } = useWalletLogger(wallet)

  const [config, saveConfig, clearConfig] = useConfig(wallet)
  const hasConfig = wallet?.fields.length > 0
  const _isConfigured = isConfigured({ ...wallet, config })

  const enablePayments = useCallback(() => {
    saveConfig(config => ({ ...config, enabled: true }), { skipTests: true })
    logger.ok('payments enabled')
    disableFreebies().catch(console.error)
  }, [saveConfig, logger])

  const disablePayments = useCallback(() => {
    saveConfig(config => ({ ...config, enabled: false }), { skipTests: true })
    logger.info('payments disabled')
  }, [name, me, logger])

  const status = config?.enabled ? Status.Enabled : Status.Initialized
  const enabled = status === Status.Enabled
  const priority = config?.priority

  const sendPayment = useCallback(async (bolt11) => {
    const hash = bolt11Tags(bolt11).payment_hash
    logger.info('sending payment:', `payment_hash=${hash}`)
    try {
      const preimage = await wallet.sendPayment(bolt11, config, { me, logger, status, showModal })
      logger.ok('payment successful:', `payment_hash=${hash}`, `preimage=${preimage}`)
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error('payment failed:', `payment_hash=${hash}`, message)
      throw err
    }
  }, [me, wallet, config, logger, status])

  const setPriority = useCallback(async (priority) => {
    if (_isConfigured && priority !== config.priority) {
      try {
        await saveConfig({ ...config, priority }, { logger, priorityOnly: true })
      } catch (err) {
        toaster.danger(`failed to change priority of ${wallet.name} wallet: ${err.message}`)
      }
    }
  }, [wallet, config, toaster])

  const save = useCallback(async (newConfig) => {
    await saveConfig(newConfig, { logger })
  }, [saveConfig, me, logger])

  // delete is a reserved keyword
  const delete_ = useCallback(async (options) => {
    try {
      await clearConfig({ logger, ...options })
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error(message)
      throw err
    }
  }, [clearConfig, logger, disablePayments])

  const deleteLogs_ = useCallback(async (options) => {
    // first argument is to override the wallet
    return await deleteLogs(options)
  }, [deleteLogs])

  if (!wallet) return null

  // Assign everything to wallet object so every function that is passed this wallet object in this
  // `useWallet` hook has access to all others via the reference to it.
  // Essentially, you can now use functions like `enablePayments` _inside_ of functions that are
  // called by `useWallet` even before enablePayments is defined and not only in functions
  // that use the return value of `useWallet`.
  wallet.isConfigured = _isConfigured
  wallet.enablePayments = enablePayments
  wallet.disablePayments = disablePayments
  wallet.canSend = !!wallet.sendPayment
  wallet.canReceive = !!wallet.createInvoice
  wallet.config = config
  wallet.save = save
  wallet.delete = delete_
  wallet.deleteLogs = deleteLogs_
  wallet.setPriority = setPriority
  wallet.hasConfig = hasConfig
  wallet.status = status
  wallet.enabled = enabled
  wallet.priority = priority
  wallet.logger = logger

  // can't assign sendPayment to wallet object because it already exists
  // as an imported function and thus can't be overwritten
  return { ...wallet, sendPayment }
}

function extractConfig (fields, config, client) {
  return Object.entries(config).reduce((acc, [key, value]) => {
    const field = fields.find(({ name }) => name === key)

    // filter server config which isn't specified as wallet fields
    if (client && (key.startsWith('autoWithdraw') || key === 'id')) return acc

    // field might not exist because config.enabled doesn't map to a wallet field
    if (!field || (client ? isClientField(field) : isServerField(field))) {
      return {
        ...acc,
        [key]: value
      }
    } else {
      return acc
    }
  }, {})
}

export function isServerField (f) {
  return f.serverOnly || !f.clientOnly
}

export function isClientField (f) {
  return f.clientOnly || !f.serverOnly
}

function extractClientConfig (fields, config) {
  return extractConfig(fields, config, true)
}

function extractServerConfig (fields, config) {
  return extractConfig(fields, config, false)
}

function useConfig (wallet) {
  const { me } = useMe()

  let storageKey = `wallet:${wallet.name}`

  if (wallet.perDevice) {
    storageKey += ':local-only'
  }

  const [clientConfig, setClientConfig, clearClientConfig] = useVaultStorageState(storageKey, {})

  const [serverConfig, setServerConfig, clearServerConfig] = useServerConfig(wallet)

  const hasClientConfig = !!wallet?.sendPayment
  const hasServerConfig = !!wallet?.walletType

  let config = {}
  if (hasClientConfig) config = clientConfig
  if (hasServerConfig) {
    const { enabled, priority } = config || {}
    config = {
      ...config,
      ...serverConfig
    }
    // wallet is enabled if enabled is set in client or server config
    config.enabled ||= enabled
    // priority might only be set on client or server
    // ie. if send+recv is available but only one is configured
    config.priority ||= priority
  }

  const saveConfig = useCallback(async (newConfig, { logger, skipTests } = {}) => {
    if (typeof newConfig === 'function') {
      newConfig = newConfig(config)
    }

    // NOTE:
    //   verifying the client/server configuration before saving it
    //   prevents unsetting just one configuration if both are set.
    //   This means there is no way of unsetting just one configuration
    //   since 'detach' detaches both.
    //   Not optimal UX but the trade-off is saving invalid configurations
    //   and maybe it's not that big of an issue.
    if (hasClientConfig) {
      let newClientConfig = extractClientConfig(wallet.fields, newConfig)

      let valid = true
      try {
        const transformedConfig = await walletValidate(wallet, newClientConfig)
        if (transformedConfig) {
          newClientConfig = Object.assign(newClientConfig, transformedConfig)
        }
      } catch {
        valid = false
      }

      if (valid) {
        if (skipTests) {
          setClientConfig(newClientConfig)
        } else {
          try {
            // XXX: testSendPayment can return a new config (e.g. lnc)
            const newerConfig = await wallet.testSendPayment?.(newConfig, { me, logger })
            if (newerConfig) {
              newClientConfig = Object.assign(newClientConfig, newerConfig)
            }
          } catch (err) {
            logger.error(err.message)
            throw err
          }

          setClientConfig(newClientConfig)
          logger.ok(wallet.isConfigured ? 'payment details updated' : 'wallet attached for payments')
          if (newConfig.enabled) wallet.enablePayments()
          else wallet.disablePayments()
        }
      }
    }

    if (hasServerConfig) {
      let newServerConfig = extractServerConfig(wallet.fields, newConfig)

      let valid = true
      try {
        const transformedConfig = await walletValidate(wallet, newServerConfig)
        if (transformedConfig) {
          newServerConfig = Object.assign(newServerConfig, transformedConfig)
        }
      } catch {
        valid = false
      }

      if (valid) await setServerConfig(newServerConfig, { priorityOnly: skipTests })
    }
  }, [config, hasClientConfig, hasServerConfig, setClientConfig, setServerConfig, wallet])

  const clearConfig = useCallback(async ({ logger, clientOnly }) => {
    if (hasClientConfig) {
      clearClientConfig()
      wallet.disablePayments()
      logger.ok('wallet detached for payments')
    }
    if (hasServerConfig && !clientOnly) await clearServerConfig()
  }, [hasClientConfig, hasServerConfig, clearClientConfig, clearServerConfig, wallet])

  return [config, saveConfig, clearConfig]
}

function isConfigured ({ fields, config }) {
  if (!config || !fields) return false

  // a wallet is configured if all of its required fields are set
  let val = fields.every(f => {
    return f.optional ? true : !!config?.[f.name]
  })

  // however, a wallet is not configured if all fields are optional and none are set
  // since that usually means that one of them is required
  if (val && fields.length > 0) {
    val = !(fields.every(f => f.optional) && fields.every(f => !config?.[f.name]))
  }

  return val
}

function useServerConfig (wallet) {
  const client = useApolloClient()
  const { me } = useMe()

  const { data, refetch: refetchConfig } = useQuery(WALLET_BY_TYPE, { variables: { type: wallet?.walletType }, skip: !wallet?.walletType })

  const walletId = data?.walletByType?.id
  const serverConfig = {
    id: walletId,
    priority: data?.walletByType?.priority,
    enabled: data?.walletByType?.enabled,
    ...data?.walletByType?.wallet
  }
  delete serverConfig.__typename

  const autowithdrawSettings = autowithdrawInitial({ me })
  const config = { ...serverConfig, ...autowithdrawSettings }

  const saveConfig = useCallback(async ({
    autoWithdrawThreshold,
    autoWithdrawMaxFeePercent,
    priority,
    enabled,
    ...config
  }, { priorityOnly }) => {
    try {
      const mutation = generateMutation(wallet)
      return await client.mutate({
        mutation,
        variables: {
          ...config,
          id: walletId,
          settings: {
            autoWithdrawThreshold: Number(autoWithdrawThreshold),
            autoWithdrawMaxFeePercent: Number(autoWithdrawMaxFeePercent),
            priority,
            enabled
          },
          priorityOnly
        }
      })
    } finally {
      client.refetchQueries({ include: ['WalletLogs'] })
      refetchConfig()
    }
  }, [client, walletId])

  const clearConfig = useCallback(async () => {
    // only remove wallet if there is a wallet to remove
    if (!walletId) return

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
  headerArgs += wallet.fields
    .filter(isServerField)
    .map(f => {
      let arg = `$${f.name}: String`
      if (!f.optional) {
        arg += '!'
      }
      return arg
    }).join(', ')
  headerArgs += ', $settings: AutowithdrawSettings!, $priorityOnly: Boolean'

  let inputArgs = 'id: $id, '
  inputArgs += wallet.fields
    .filter(isServerField)
    .map(f => `${f.name}: $${f.name}`).join(', ')
  inputArgs += ', settings: $settings, priorityOnly: $priorityOnly'

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
      if (w.canSend) {
        await w.delete({ clientOnly: true })
      }
      await w.deleteLogs({ clientOnly: true })
    }
  }, [wallets])

  return { wallets, resetClient }
}
