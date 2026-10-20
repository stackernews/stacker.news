import { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { isSearchPath, SEARCH_PATH } from '@/lib/search'
import { useRememberSub, useRememberSearch } from './recent'

const SearchStateContext = createContext()

export function SearchStateProvider ({ sub, user, children }) {
  const router = useRouter()
  // default query, if on a search page it uses that query string, otherwise empty
  const q = isSearchPath(router.pathname) && typeof router.query.q === 'string' ? router.query.q : undefined

  // default page state based on the initial query
  const page = useMemo(() => ({ text: q ?? '' }), [q])
  // sub is the territory in the URL, a post's territory doesn't count as a visit.
  // every page renders this provider, so visits and searches are remembered here.
  // a recent search opens /search, so searches on /stackers/search aren't remembered
  useRememberSub(sub)
  useRememberSearch(router.pathname === SEARCH_PATH ? q : undefined)

  const [state, setState] = useState({ page, ...page })
  // resets search bar state when the URL query changes
  if (state.page !== page) setState({ page, ...page })

  const setText = useCallback(text => setState(prev => ({ ...prev, text })), [])
  const reset = useCallback(() => setState(prev => ({ ...prev, ...prev.page })), [])

  const { text } = state
  const value = useMemo(() => ({ text, setText, reset, sub }), [text, setText, reset, sub])

  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>
}

export function useSearchState () {
  return useContext(SearchStateContext)
}
