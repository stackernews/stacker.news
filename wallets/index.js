import { useMe } from '@/components/me'
import { WALLETS } from '@/fragments/wallet'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'
import { useQuery } from '@apollo/client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getStorageKey, getWalletByType, Status, walletPrioritySort, canSend } from './common'
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
    // form wallets into a list of { config, def }
    const wallets = walletDefs.map(w => {
      try {
        const config = window.localStorage.getItem(getStorageKey(w.name, me))
        return { def: w, config: JSON.parse(config) }
      } catch (e) {
        return null
      }
    }).filter(Boolean)
    setWallets(wallets)
  }, [me, setWallets])

  // watch for changes to local storage
  useEffect(() => {
    loadWallets()
    // reload wallets if local storage to wallet changes
    const handler = (event) => {
      if (event.key.startsWith('wallet:')) {
        loadWallets()
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [loadWallets])

  return wallets
}

const walletDefsOnly = walletDefs.map(w => ({ def: w, config: {} }))

export function WalletsProvider ({ children }) {
  const { me } = useMe()
  const { decrypt } = useVault()
  const localWallets = useLocalWallets()

  // TODO: instead of polling, this should only be called when the vault key is updated
  // or a denormalized field on the user 'vaultUpdatedAt' is changed
  const { data } = useQuery(WALLETS, {
    pollInterval: NORMAL_POLL_INTERVAL,
    nextFetchPolicy: 'cache-and-network',
    skip: !me?.id || SSR
  })

  const wallets = useMemo(() => {
    // form wallets into a list of { config, def }
    const wallets = data?.wallets?.map(w => {
      const def = getWalletByType(w.type)
      const { vaultEntries, ...config } = w
      for (const { key, value } of vaultEntries) {
        config[key] = decrypt(value)
      }

      return { config, def }
    }) ?? []

    // merge wallets on name
    const merged = {}
    for (const wallet of [...walletDefsOnly, ...localWallets, ...wallets]) {
      merged[wallet.def.name] = { ...merged[wallet.def.name], ...wallet }
    }
    return Object.values(merged)
      .sort(walletPrioritySort)
      .map(w => ({ ...w, status: w.config?.enabled ? Status.Enabled : Status.Disabled }))
  }, [data?.wallets, localWallets])

  // provides priority sorted wallets to children
  return (
    <WalletsContext.Provider value={wallets}>
      {children}
    </WalletsContext.Provider>
  )
}

export function useWallets () {
  return useContext(WalletsContext)
}

export function useWallet (name) {
  const wallets = useWallets()

  const wallet = useMemo(() => {
    if (name) {
      return wallets.find(w => w.def.name === name)
    }

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
