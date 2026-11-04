import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useMe } from '@/components/me'
import { joinScope, splitScope, SEARCH_PATH } from '@/lib/search'

// each list keeps more than the bar shows, since visited territories that
// aren't active anymore get filtered out
const MAX_RECENT = 8

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

const SUBS = 'recentTerritories'
const SEARCHES = 'recentSearches'

const useRecentSubs = () => useRecent(SUBS)

const useRecentSearches = () => useRecent(SEARCHES)

// visiting territories or search URLs contribute to the recent list
// so it's read again on every open
function useRecentEntries (name, open) {
  const { getRecent, clearRecent } = useRecent(name)
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (open) setEntries(getRecent())
  }, [open, getRecent])

  const clear = useCallback(() => {
    clearRecent()
    setEntries([])
  }, [clearRecent])

  return [entries, clear]
}

export const useRecentSubEntries = open => useRecentEntries(SUBS, open)

export const useRecentSearchEntries = open => useRecentEntries(SEARCHES, open)

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

export function useRememberHistory (sub) {
  const router = useRouter()
  const q = router.pathname === SEARCH_PATH && typeof router.query.q === 'string' ? router.query.q : undefined
  useRememberSub(sub)
  useRememberSearch(q)
}
