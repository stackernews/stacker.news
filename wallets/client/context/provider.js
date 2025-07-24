import { createContext, useContext, useReducer } from 'react'
import walletsReducer from './reducer'
import { useServerWallets, useKeyCheck, useAutomatedRetries, useKeyInit, useWalletMigration } from './hooks'
import { WebLnProvider } from '@/wallets/lib/protocols/webln'

// https://react.dev/learn/scaling-up-with-reducer-and-context
const WalletsContext = createContext(null)
const WalletsDispatchContext = createContext(null)

export function useWallets () {
  const { wallets } = useContext(WalletsContext)
  return wallets
}

export function useTemplates () {
  const { templates } = useContext(WalletsContext)
  return templates
}

export function useWalletsLoading () {
  const { walletsLoading } = useContext(WalletsContext)
  return walletsLoading
}

export function useWalletsError () {
  const { walletsError } = useContext(WalletsContext)
  return walletsError
}

export function useWalletsDispatch () {
  return useContext(WalletsDispatchContext)
}

export function useKey () {
  const { key } = useContext(WalletsContext)
  return key
}

export function useKeyHash () {
  const { keyHash } = useContext(WalletsContext)
  return keyHash
}

export function useKeyUpdatedAt () {
  const { keyUpdatedAt } = useContext(WalletsContext)
  return keyUpdatedAt
}

export function useKeyError () {
  const { keyError } = useContext(WalletsContext)
  return keyError
}

export default function WalletsProvider ({ children }) {
  const [state, dispatch] = useReducer(walletsReducer, {
    wallets: [],
    walletsLoading: true,
    walletsError: null,
    templates: [],
    key: null,
    keyHash: null,
    keyUpdatedAt: null,
    keyError: null
  })

  return (
    <WalletsContext.Provider value={state}>
      <WalletsDispatchContext.Provider value={dispatch}>
        <WalletHooks>
          <WebLnProvider>
            {children}
          </WebLnProvider>
        </WalletHooks>
      </WalletsDispatchContext.Provider>
    </WalletsContext.Provider>
  )
}

function WalletHooks ({ children }) {
  useServerWallets()
  useKeyCheck()
  useAutomatedRetries()
  useKeyInit()

  // TODO(wallet-v2): remove migration code
  // =============================================================
  // ****** Below is the migration code for WALLET v1 -> v2 ******
  //   remove when we can assume migration is complete (if ever)
  // =============================================================

  useWalletMigration()

  return children
}
