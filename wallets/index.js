import { useMe } from '@/components/me'
import { SET_WALLET_PRIORITY, WALLETS } from '@/fragments/wallet'
import { SSR, LONG_POLL_INTERVAL as WALLETS_DISPLAY_BALANCE_REFRESH_TIME } from '@/lib/constants'
import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getStorageKey, getWalletByType, walletPrioritySort, canSend, isConfigured, upsertWalletVariables, siftConfig, saveWalletLocally } from './common'
import useVault from '@/components/vault/use-vault'
import { useWalletLogger } from '@/components/wallet-logger'
import { decode as bolt11Decode } from 'bolt11'
import walletDefs from '@/wallets/client'
import { generateMutation } from './graphql'
import { formatSats } from '@/lib/format'

const WalletsContext = createContext({
  wallets: []
})

function useLocalWallets () {
  const { me } = useMe()
  const [wallets, setWallets] = useState([])

  const loadWallets = useCallback(() => {
    // form wallets from local storage into a list of { config, def }
    const wallets = walletDefs.map(w => {
      try {
        const storageKey = getStorageKey(w.name, me?.id)
        const config = window.localStorage.getItem(storageKey)
        return { def: w, config: JSON.parse(config) }
      } catch (e) {
        return null
      }
    }).filter(Boolean)
    setWallets(wallets)
  }, [me?.id, setWallets])

  const removeWallets = useCallback(() => {
    for (const wallet of wallets) {
      const storageKey = getStorageKey(wallet.def.name, me?.id)
      window.localStorage.removeItem(storageKey)
    }
    setWallets([])
  }, [wallets, setWallets, me?.id])

  useEffect(() => {
    // listen for changes to any wallet config in local storage
    // from any window with the same origin
    const handleStorage = (event) => {
      if (event.key?.startsWith(getStorageKey(''))) {
        loadWallets()
      }
    }
    window.addEventListener('storage', handleStorage)

    loadWallets()
    return () => window.removeEventListener('storage', handleStorage)
  }, [loadWallets])

  return { wallets, reloadLocalWallets: loadWallets, removeLocalWallets: removeWallets }
}

const walletDefsOnly = walletDefs.map(w => ({ def: w, config: {} }))

export function WalletsProvider ({ children }) {
  const { isActive, decrypt } = useVault()
  const { me } = useMe()
  const { wallets: localWallets, reloadLocalWallets, removeLocalWallets } = useLocalWallets()
  const [setWalletPriority] = useMutation(SET_WALLET_PRIORITY)
  const [serverWallets, setServerWallets] = useState([])
  const client = useApolloClient()

  const { data, refetch } = useQuery(WALLETS,
    SSR ? {} : { nextFetchPolicy: 'cache-and-network' })

  // refetch wallets when the vault key hash changes or wallets are updated
  useEffect(() => {
    if (me?.privates?.walletsUpdatedAt) {
      refetch()
    }
  }, [me?.privates?.walletsUpdatedAt, me?.privates?.vaultKeyHash, refetch])

  useEffect(() => {
    const loadWallets = async () => {
      if (!data?.wallets) return
      // form wallets into a list of { config, def }
      const wallets = []
      for (const w of data.wallets) {
        const def = getWalletByType(w.type)
        const { vaultEntries, ...config } = w
        if (isActive) {
          for (const { key, iv, value } of vaultEntries) {
            try {
              config[key] = await decrypt({ iv, value })
            } catch (e) {
              console.error('error decrypting vault entry', e)
            }
          }
        }

        // the specific wallet config on the server is stored in wallet.wallet
        // on the client, it's stored unnested
        wallets.push({ config: { ...config, ...w.wallet }, def, vaultEntries })
      }

      setServerWallets(wallets)
    }
    loadWallets()
  }, [data?.wallets, decrypt, isActive])

  // merge wallets on name like: { ...unconfigured, ...localConfig, ...serverConfig }
  const wallets = useMemo(() => {
    const merged = {}
    for (const wallet of [...walletDefsOnly, ...localWallets, ...serverWallets]) {
      merged[wallet.def.name] = {
        def: {
          ...wallet.def,
          requiresConfig: wallet.def.fields.length > 0
        },
        config: {
          ...merged[wallet.def.name]?.config,
          ...Object.fromEntries(
            Object.entries(wallet.config ?? {}).map(([key, value]) => [
              key,
              value ?? merged[wallet.def.name]?.config?.[key]
            ])
          )
        },
        vaultEntries: wallet.vaultEntries
      }
    }

    // sort by priority, then add status field
    return Object.values(merged).sort(walletPrioritySort)
  }, [serverWallets, localWallets])

  const settings = useMemo(() => {
    return {
      autoWithdrawMaxFeePercent: me?.privates?.autoWithdrawMaxFeePercent,
      autoWithdrawThreshold: me?.privates?.autoWithdrawThreshold,
      autoWithdrawMaxFeeTotal: me?.privates?.autoWithdrawMaxFeeTotal
    }
  }, [me?.privates?.autoWithdrawMaxFeePercent, me?.privates?.autoWithdrawThreshold, me?.privates?.autoWithdrawMaxFeeTotal])

  // whenever the vault key is set, and we have local wallets,
  // we'll send any merged local wallets to the server, and delete them from local storage
  const syncLocalWallets = useCallback(async encrypt => {
    const walletsToSync = wallets.filter(w =>
      // only sync wallets that have a local config
      localWallets.some(localWallet => localWallet.def.name === w.def.name && !!localWallet.config)
    )
    if (encrypt && walletsToSync.length > 0) {
      for (const wallet of walletsToSync) {
        const mutation = generateMutation(wallet.def)
        const append = {}
        // if the wallet has server-only fields set, add the settings to the mutation variables
        if (wallet.def.fields.some(f => f.serverOnly && wallet.config[f.name])) {
          append.settings = settings
        }
        const variables = await upsertWalletVariables(wallet, encrypt, append)
        await client.mutate({ mutation, variables })
      }
      removeLocalWallets()
    }
  }, [wallets, localWallets, removeLocalWallets, settings])

  const unsyncLocalWallets = useCallback(() => {
    for (const wallet of wallets) {
      const { clientWithShared } = siftConfig(wallet.def.fields, wallet.config)
      if (canSend({ def: wallet.def, config: clientWithShared })) {
        saveWalletLocally(wallet.def.name, clientWithShared, me?.id)
      }
    }
    reloadLocalWallets()
  }, [wallets, me?.id, reloadLocalWallets])

  const setPriorities = useCallback(async (priorities) => {
    for (const { wallet, priority } of priorities) {
      if (!isConfigured(wallet)) {
        throw new Error(`cannot set priority for unconfigured wallet: ${wallet.def.name}`)
      }

      if (wallet.config?.id) {
        // set priority on server if it has an id
        await setWalletPriority({ variables: { id: wallet.config.id, priority } })
      } else {
        const storageKey = getStorageKey(wallet.def.name, me?.id)
        const config = window.localStorage.getItem(storageKey)
        const newConfig = { ...JSON.parse(config), priority }
        window.localStorage.setItem(storageKey, JSON.stringify(newConfig))
      }
    }
    // reload local wallets if any priorities were set
    if (priorities.length > 0) {
      reloadLocalWallets()
    }
  }, [setWalletPriority, me?.id, reloadLocalWallets])

  const [displayBalances, setDisplayBalances] = useState({})

  useEffect(() => {
    let timeoutId = null
    let terminated = false

    const refreshPeriodically = async () => {
      const finalStates = {}
      await Promise.allSettled(wallets
        .filter(w => isEnabledSendingWallet(w) && w.config?.showBalance)
        .map(async wallet => {
          const newState = finalStates[wallet.def.name] = { msats: 0, error: null }
          try {
            if (!wallet.def.getBalance) throw new Error(`${wallet.def.name} does not support getBalance`)
            const balance = await wallet.def.getBalance(wallet.config)
            newState.msats = balance
          } catch (error) {
            console.warn(error)
            // we'll handle the error downstream where it makes sense
            newState.error = error
            newState.msats = 0n
          }

          if (terminated) return

          // early additive state aggregation:
          // overwrites the balance data of each wallet as soon as it is available
          setDisplayBalances((old) => {
            const oldState = old[wallet.def.name]
            if (
              !oldState ||
              oldState.msats !== newState.msats ||
              (!!oldState.error) !== (!!newState.error)
            ) {
            // ensure the state update happens only if something changed
              return {
                ...old,
                [wallet.def.name]: newState
              }
            }
            return old
          })
        }))

      if (terminated) return
      // finalize the state update after all the promises have settled
      // this gets rid of the stale data lingering after the additive update
      // (eg. disabled or disconnected wallets) without doing an explicit cleanup
      // pre-pass
      setDisplayBalances(finalStates)
      // rerun after a while
      timeoutId = setTimeout(refreshPeriodically, WALLETS_DISPLAY_BALANCE_REFRESH_TIME)
    }

    refreshPeriodically()
    return () => {
      terminated = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [wallets])

  // provides priority sorted wallets to children, a function to reload local wallets,
  // and a function to set priorities
  return (
    <WalletsContext.Provider
      value={{
        wallets,
        displayBalances,
        reloadLocalWallets,
        setPriorities,
        onVaultKeySet: syncLocalWallets,
        beforeDisconnectVault: unsyncLocalWallets,
        removeLocalWallets
      }}
    >
      {children}
    </WalletsContext.Provider>
  )
}

export function useWallets () {
  return useContext(WalletsContext)
}

export function useWallet (name) {
  const { wallets } = useWallets()

  const wallet = useMemo(() => {
    if (name) {
      return wallets.find(w => w.def.name === name)
    }

    // return the first enabled wallet that is available and can send
    return wallets
      .filter(w => !w.def.isAvailable || w.def.isAvailable())
      .filter(w => w.config?.enabled && canSend(w))[0]
  }, [wallets, name])

  const { logger } = useWalletLogger(wallet?.def)

  const sendPayment = useCallback(async (bolt11) => {
    const decoded = bolt11Decode(bolt11)
    logger.info(`↗ sending payment: ${formatSats(decoded.satoshis)}`, { bolt11 })
    try {
      const preimage = await wallet.def.sendPayment(bolt11, wallet.config, { logger })
      logger.ok(`↗ payment sent: ${formatSats(decoded.satoshis)}`, { bolt11, preimage })
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error(`payment failed: ${message}`, { bolt11 })
      throw err
    }
  }, [wallet, logger])

  if (!wallet) return null

  return { ...wallet, sendPayment }
}

export function isEnabledSendingWallet (w) {
  return (!w.def.isAvailable || w.def.isAvailable()) &&
        w.config?.enabled &&
        canSend(w)
}
