import { createContext, useContext, useMemo } from 'react'
import { UNKNOWN_LINK_REL } from '@/lib/constants'

const LexicalItemContext = createContext({
  imgproxyUrls: null,
  topLevel: false,
  outlawed: false,
  rel: UNKNOWN_LINK_REL
})

export function LexicalItemContextProvider ({ imgproxyUrls, topLevel, outlawed, rel, children }) {
  const value = useMemo(() => ({
    imgproxyUrls,
    topLevel,
    outlawed,
    rel
  }), [imgproxyUrls, topLevel, outlawed, rel])

  return (
    <LexicalItemContext.Provider value={value}>
      {children}
    </LexicalItemContext.Provider>
  )
}

export function useLexicalItemContext () {
  return useContext(LexicalItemContext)
}
