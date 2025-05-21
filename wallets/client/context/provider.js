import { createContext, useContext, useEffect, useReducer } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@apollo/client'
import { WALLETS } from '@/fragments/wallet'

import RetryHandler from './retry'
import walletsReducer, { FIRST_PAGE, RESET_PAGE, SET_WALLETS } from './reducer'

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

  useServerWallets({ dispatch })
  usePageNavigation({ dispatch })

  // TODO(wallet-v2): add WebLnProvider to manage WebLN state
  return (
    <WalletsContext.Provider value={state}>
      <WalletsDispatchContext.Provider value={dispatch}>
        <RetryHandler>
          {children}
        </RetryHandler>
      </WalletsDispatchContext.Provider>
    </WalletsContext.Provider>
  )
}

function useServerWallets ({ dispatch }) {
  const query = useQuery(WALLETS)

  useEffect(() => {
    if (query.error) {
      console.error('failed to fetch wallets:', query.error)
      return
    }
    if (query.loading) return
    dispatch({ type: SET_WALLETS, wallets: query.data.wallets })
  }, [query])
}

function usePageNavigation ({ dispatch }) {
  const router = useRouter()

  useEffect(() => {
    function handleRouteChangeComplete (url) {
      if (!url.startsWith('/wallets')) {
        dispatch({ type: RESET_PAGE })
      }
    }
    router.events.on('routeChangeComplete', handleRouteChangeComplete)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChangeComplete)
    }
  }, [router, dispatch])
}
