import { createContext, useContext, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { isSearchPath, splitScope } from '@/lib/search'

const SearchStateContext = createContext()

export function SearchStateProvider ({ sub, user, children }) {
  const router = useRouter()
  const q = isSearchPath(router.pathname) && typeof router.query.q === 'string' ? router.query.q : undefined

  // on a search page the bar starts from the query's chips and text, and
  // everywhere else from the page's territory and stacker
  const page = useMemo(() => q === undefined ? { scope: { sub, user }, text: '' } : splitScope(q), [q, sub, user])

  const [state, setState] = useState({ page, ...page })
  // resets search bar state when the page state changes
  if (state.page !== page) setState({ page, ...page })

  const setText = text => setState(prev => ({ ...prev, text }))
  // merges into the chips, undefined removes one
  const setScope = scope => setState(prev => ({ ...prev, scope: { ...prev.scope, ...scope } }))
  const reset = () => setState(prev => ({ ...prev, ...prev.page }))

  const value = { scope: state.scope, text: state.text, setText, setScope, reset, sub }
  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>
}

export function useSearchState () {
  return useContext(SearchStateContext)
}
