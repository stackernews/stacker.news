import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useMe } from '@/components/me'
import { joinScope, splitScope, SEARCH_PATH } from '@/lib/search'

// how many entries each list keeps, more than the bar shows because
// visited territories that aren't active anymore get filtered out
const MAX_RECENT = 8

// recent entries in local storage, newest first, separate for each account and for logged out
function useRecent (name) {
  const { me } = useMe()
  const storageKey = `${name}:${me?.id ?? 'anon'}`

  const getRecent = useCallback(() => {
    try {
      const entries = JSON.parse(window.localStorage.getItem(storageKey))
      return Array.isArray(entries) ? entries : []
    } catch {
      return []
    }
  }, [storageKey])

  // moves the entry to the top and drops older copies, ignoring case
  const addRecent = useCallback((entry) => {
    const lower = entry.toLowerCase()
    const entries = [entry, ...getRecent().filter(other => other.toLowerCase() !== lower)]
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(entries.slice(0, MAX_RECENT)))
    } catch {}
  }, [storageKey, getRecent])

  const clearRecent = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey)
    } catch {}
  }, [storageKey])

  return { getRecent, addRecent, clearRecent }
}

// recent territory names
export const useRecentSubs = () => useRecent('recentTerritories')

// recent search queries, with their ~territory and @stacker
export const useRecentSearches = () => useRecent('recentSearches')

function useRememberSub (sub) {
  const { addRecent } = useRecentSubs()
  useEffect(() => {
    if (sub) addRecent(sub)
  }, [sub, addRecent])
}

function useRememberSearch (q) {
  const { addRecent } = useRecentSearches()
  useEffect(() => {
    if (!q) return
    // ~territory and @stacker go first, so 'btc ~bitcoin' and '~bitcoin btc' are one entry
    const { scope, text } = splitScope(q)
    const search = joinScope(scope, text)
    if (search) addRecent(search)
  }, [q, addRecent])
}

// remembers the territory in the URL and the searches made on /search
export function useRememberHistory (sub) {
  const router = useRouter()
  const q = router.pathname === SEARCH_PATH && typeof router.query.q === 'string' ? router.query.q : undefined
  useRememberSub(sub)
  useRememberSearch(q)
}
