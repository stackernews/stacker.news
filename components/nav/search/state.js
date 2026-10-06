import { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { isSearchPath } from '@/lib/search'

const SearchStateContext = createContext()

export function SearchStateProvider ({ sub, user, children }) {
  const router = useRouter()
  // default query, if on a search page it uses that query string, otherwise empty
  const q = isSearchPath(router.pathname) && typeof router.query.q === 'string' ? router.query.q : undefined

  // default page state based on the initial query
  const page = useMemo(() => ({ text: q ?? '' }), [q])

  const [state, setState] = useState({ page, ...page })
  // resets search bar state when the URL query changes
  if (state.page !== page) setState({ page, ...page })

  const setText = useCallback(text => setState(prev => ({ ...prev, text })), [])
  const reset = useCallback(() => setState(prev => ({ ...prev, ...prev.page })), [])

  const { text } = state
  const value = useMemo(() => ({ text, setText, reset }), [text, setText, reset])

  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>
}

export function useSearchState () {
  return useContext(SearchStateContext)
}
