import { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { isSearchPath, splitScope } from '@/lib/search'

const SearchStateContext = createContext()

// the chips (scope) and the text of the search bar
export function SearchStateProvider ({ sub, user, children }) {
  const router = useRouter()
  // default query, if on a search page it uses that query string, otherwise empty
  const q = isSearchPath(router.pathname) && typeof router.query.q === 'string' ? router.query.q : undefined

  // default page state: the chips and text of the query on a search page, the
  // page's territory and stacker everywhere else
  const page = useMemo(() => q === undefined ? { scope: { sub, user }, text: '' } : splitScope(q), [q, sub, user])

  const [state, setState] = useState({ page, ...page })
  // resets search bar state when the page state changes
  if (state.page !== page) setState({ page, ...page })

  const setText = useCallback(text => setState(prev => ({ ...prev, text })), [])
  // merges into the chips, undefined removes one
  const setScope = useCallback(scope => setState(prev => ({ ...prev, scope: { ...prev.scope, ...scope } })), [])
  const reset = useCallback(() => setState(prev => ({ ...prev, ...prev.page })), [])

  const { scope, text } = state
  const value = useMemo(() => ({ scope, text, setText, setScope, reset, sub }), [scope, text, setText, setScope, reset, sub])

  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>
}

export function useSearchState () {
  return useContext(SearchStateContext)
}
