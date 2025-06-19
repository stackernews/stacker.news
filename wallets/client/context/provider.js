import { createContext, useContext, useReducer } from 'react'
import walletsReducer, { FIRST_PAGE } from './reducer'
import { useServerWallets, usePageNavigation, useAutomatedRetries, useKeyInit } from './hooks'
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

export function useLoading () {
  const { loading } = useContext(WalletsContext)
  return loading
}

export function usePage () {
  const { page } = useContext(WalletsContext)
  return page
}

export function useWalletsDispatch () {
  return useContext(WalletsDispatchContext)
}

export function useKey () {
  const { key } = useContext(WalletsContext)
  return key
}

export default function WalletsProvider ({ children }) {
  const [state, dispatch] = useReducer(walletsReducer, {
    page: FIRST_PAGE,
    wallets: [],
    templates: [],
    key: null,
    loading: true
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
  usePageNavigation()
  useAutomatedRetries()
  useKeyInit()

  return children
}
