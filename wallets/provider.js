import { createContext, useContext, useEffect, useReducer } from 'react'
import { useWalletIndicator } from '@/wallets/indicator'
import { useRouter } from 'next/router'
import { useQuery } from '@apollo/client'
import { WALLETS } from '@/fragments/wallet'

// https://react.dev/learn/scaling-up-with-reducer-and-context
const WalletsContext = createContext(null)
const WalletsDispatchContext = createContext(null)

// pages
export const FIRST_PAGE = 'FIRST_PAGE'
export const WALLET_LIST_PAGE = 'WALLET_LIST_PAGE'

// page actions
export const RESET_PAGE = 'RESET_PAGE'
export const NEXT_PAGE = 'NEXT_PAGE'

// wallet actions
const SET_WALLETS = 'SET_WALLETS'

export function WalletsProvider ({ children }) {
  const router = useRouter()
  const { indicator, loading } = useWalletIndicator()
  const query = useQuery(WALLETS)

  const [state, dispatch] = useReducer(walletsReducer, {
    page: loading || indicator ? FIRST_PAGE : WALLET_LIST_PAGE,
    // TODO(wallet-v2): this also includes wallet templates, so these are not the wallets we will use for payments
    wallets: []
  })

  useEffect(() => {
    if (query.error) {
      console.error('failed to fetch wallets:', query.error)
      return
    }
    if (query.loading) return
    dispatch({ type: SET_WALLETS, wallets: query.data.wallets })
  }, [query])

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

  return (
    <WalletsContext.Provider value={state}>
      <WalletsDispatchContext.Provider value={dispatch}>
        {children}
      </WalletsDispatchContext.Provider>
    </WalletsContext.Provider>
  )
}

function walletsReducer (state, action) {
  switch (action.type) {
    case RESET_PAGE:
      return {
        ...state,
        page: FIRST_PAGE
      }
    case NEXT_PAGE:
      return {
        ...state,
        page: state.page === FIRST_PAGE
          ? WALLET_LIST_PAGE
          : undefined
      }
    case SET_WALLETS:
      return {
        ...state,
        wallets: action.wallets
      }
    default:
      return state
  }
}

export function useWallets () {
  return useContext(WalletsContext)
}

export function useWalletsDispatch () {
  return useContext(WalletsDispatchContext)
}
