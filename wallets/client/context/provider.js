import { createContext, useContext, useReducer } from 'react'
import walletsReducer, { FIRST_PAGE } from './reducer'
import { useServerWallets, usePageNavigation, useAutomatedRetries } from './hooks'
import { WebLnProvider } from '@/wallets/lib/protocols/webln'

// https://react.dev/learn/scaling-up-with-reducer-and-context
const WalletsContext = createContext(null)
const WalletsDispatchContext = createContext(null)

export function useWallets () {
  return useContext(WalletsContext)
}

export function useWalletsDispatch () {
  return useContext(WalletsDispatchContext)
}

export default function WalletsProvider ({ children }) {
  const [state, dispatch] = useReducer(walletsReducer, {
    // TODO(wallet-v2): if there's no indicator, this should show the wallet list page
    page: FIRST_PAGE,
    // TODO(wallet-v2): this also includes wallet templates, so these are not the wallets we will use for payments
    wallets: []
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

  return children
}
