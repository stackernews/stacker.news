import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { isSearchPath, splitScope } from '@/lib/search'
import { useRememberHistory } from './recent'

const SearchStateContext = createContext()

export function SearchStateProvider ({ sub, user, children }) {
  const router = useRouter()
  useRememberHistory(sub)
  const q = isSearchPath(router.pathname) && typeof router.query.q === 'string' ? router.query.q : undefined

  const page = useMemo(() => q === undefined ? { scope: { sub, user }, text: '' } : splitScope(q), [q, sub, user])

  const [state, setState] = useState({ page, ...page })
  if (state.page !== page) setState({ page, ...page })

  // reset search bar state when the route changes, and not on url replace (shallow)
  useEffect(() => {
    const reset = (url, { shallow }) => {
      if (!shallow) setState(prev => ({ ...prev, ...prev.page }))
    }
    router.events.on('routeChangeComplete', reset)
    return () => router.events.off('routeChangeComplete', reset)
  }, [router.events])

  const setText = text => setState(prev => ({ ...prev, text }))
  const setScope = scope => setState(prev => ({ ...prev, scope: { ...prev.scope, ...scope } }))

  const value = { scope: state.scope, text: state.text, setText, setScope, sub }
  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>
}

export function useSearchState () {
  return useContext(SearchStateContext)
}
