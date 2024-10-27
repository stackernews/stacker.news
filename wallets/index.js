import { useMe } from '@/components/me'
import { SET_WALLET_PRIORITY, WALLETS } from '@/fragments/wallet'
import { SSR } from '@/lib/constants'
import { useMutation, useQuery } from '@apollo/client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getStorageKey, getWalletByType, Status, walletPrioritySort, canSend, isConfigured } from './common'
import useVault from '@/components/vault/use-vault'
import { useWalletLogger } from '@/components/wallet-logger'
import { bolt11Tags } from '@/lib/bolt11'
import walletDefs from 'wallets/client'

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

  useEffect(() => {
    loadWallets()
  }, [loadWallets])

  return { wallets, reloadLocalWallets: loadWallets }
}

const walletDefsOnly = walletDefs.map(w => ({ def: w, config: {} }))

export function WalletsProvider ({ children }) {
  const { isActive, decrypt } = useVault()
  const { me } = useMe()
  const { wallets: localWallets, reloadLocalWallets } = useLocalWallets()
  const [setWalletPriority] = useMutation(SET_WALLET_PRIORITY)
  const [serverWallets, setServerWallets] = useState([])

  const { data, refetch } = useQuery(WALLETS,
    SSR ? {} : { nextFetchPolicy: 'cache-and-network' })

  // refetch wallets when the vault key hash changes or wallets are updated
  useEffect(() => {
    if (me?.privates?.walletsUpdatedAt) {
      refetch()
    }
  }, [me?.privates?.walletsUpdatedAt, me?.privates?.vaultKeyHash, refetch])

  useEffect(() => {
    async function loadWallets () {
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
        wallets.push({ config: { ...config, ...w.wallet }, def })
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
        def: wallet.def,
        config: {
          ...merged[wallet.def.name]?.config,
          ...Object.fromEntries(
            Object.entries(wallet.config ?? {}).map(([key, value]) => [
              key,
              value ?? merged[wallet.def.name]?.config?.[key]
            ])
          )
        }
      }
    }

    // sort by priority, then add status field
    return Object.values(merged)
      .sort(walletPrioritySort)
      .map(w => ({ ...w, status: w.config?.enabled ? Status.Enabled : Status.Disabled }))
  }, [serverWallets, localWallets])

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

  // provides priority sorted wallets to children, a function to reload local wallets,
  // and a function to set priorities
  return (
    <WalletsContext.Provider value={{ wallets, reloadLocalWallets, setPriorities }}>
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
    const hash = bolt11Tags(bolt11).payment_hash
    logger.info('sending payment:', `payment_hash=${hash}`)
    try {
      const preimage = await wallet.def.sendPayment(bolt11, wallet.config, { logger })
      logger.ok('payment successful:', `payment_hash=${hash}`, `preimage=${preimage}`)
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error('payment failed:', `payment_hash=${hash}`, message)
      throw err
    }
  }, [wallet, logger])

  return { ...wallet, sendPayment }
}
