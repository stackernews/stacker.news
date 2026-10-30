import { createContext, useContext, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { isSearchPath, splitScope } from '@/lib/search'

const SearchStateContext = createContext()

export function SearchStateProvider ({ sub, user, children }) {
  const router = useRouter()
  const q = isSearchPath(router.pathname) && typeof router.query.q === 'string' ? router.query.q : undefined

  const page = useMemo(() => q === undefined ? { scope: { sub, user }, text: '' } : splitScope(q), [q, sub, user])

  const [state, setState] = useState({ page, ...page })
  if (state.page !== page) setState({ page, ...page })

  const setText = text => setState(prev => ({ ...prev, text }))
  const setScope = scope => setState(prev => ({ ...prev, scope: { ...prev.scope, ...scope } }))
  const reset = () => setState(prev => ({ ...prev, ...prev.page }))

  const value = { scope: state.scope, text: state.text, setText, setScope, reset, sub }
  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>
}

export function useSearchState () {
  return useContext(SearchStateContext)
}
