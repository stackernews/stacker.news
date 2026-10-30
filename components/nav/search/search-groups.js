import { useMemo, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { NAV_SEARCH_NAMES } from '@/fragments/search'
import { ACTIVE_SUBS, TERRITORIES_WEEK } from '@/fragments/subs'
import { userItem, longSubItem } from './items'

const SEARCH_LIMIT = 4
const NAMES_LIMIT = 8

// territories found by name come with just their name, the rest is in the full
// list. a territory missing from the week's list had a quiet week
function toGroups ({ users = [], subs = [], activeSubs = [], weekSubs = [] }) {
  const byName = new Map(activeSubs.map(sub => [sub.name, sub]))
  const weekByName = new Map(weekSubs.map(sub => [sub.name, sub]))
  const toItem = sub => longSubItem(byName.get(sub.name) ?? sub, weekByName.get(sub.name))
  return [
    { value: 'user', label: 'stackers', items: users.map(userItem) },
    { value: 'sub', label: 'territories', layout: 'long-tiles', items: subs.map(toItem) }
  ].filter(group => group.items.length > 0)
}

function pinSubscribed (subs = []) {
  const pinned = sub => sub.meSubscription && !sub.meMuteSub
  return [...subs.filter(pinned), ...subs.filter(sub => !pinned(sub))]
}

function namesQuery (lookup) {
  if (lookup.mode === 'name') {
    if (!lookup.name) return
    return { q: lookup.name, withUsers: lookup.type === 'user', withSubs: lookup.type === 'sub', limit: NAMES_LIMIT }
  }
  if (lookup.mode === 'search' && lookup.nameQ) {
    return { q: lookup.nameQ, withUsers: true, withSubs: true, limit: SEARCH_LIMIT }
  }
}

// keeps the last results while the next ones load, as long as they are for the
// same kind of lookup. apollo's previousData doesn't work here: it survives
// skip, so results from before the input was cleared would show up again
function useLastData (data, kind) {
  const [last, setLast] = useState({ kind })
  const current = kind && data ? data : last.kind === kind ? last.data : undefined

  if (last.kind !== kind || last.data !== current) {
    setLast({ kind, data: current })
  }

  return current
}

export function useSearchGroups ({ lookup, debounced, open }) {
  const variables = namesQuery(debounced)

  const names = useQuery(NAV_SEARCH_NAMES, { variables, skip: !open || !variables })
  const data = useLastData(names.data, variables && (debounced.type ?? 'search'))
  const subs = useQuery(ACTIVE_SUBS, { skip: !open, fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' })
  const week = useQuery(TERRITORIES_WEEK, { skip: !open })

  // stackers looked up by name don't belong under a search, and the other way around
  const sameLookup = debounced.mode === lookup.mode && debounced.type === lookup.type
  const matches = sameLookup ? data : undefined
  // a ~ alone shows every territory, and so does a ~name until its matches arrive
  const allSubs = lookup.type === 'sub' && (!lookup.name || !matches)

  const activeSubs = subs.data?.activeSubs
  const weekSubs = week.data?.topSubs?.subs
  const groups = useMemo(() => {
    if (allSubs) return toGroups({ subs: pinSubscribed(activeSubs), activeSubs, weekSubs })
    return toGroups({ users: matches?.searchUsers, subs: matches?.subSuggestions, activeSubs, weekSubs })
  }, [allSubs, activeSubs, weekSubs, matches])

  // the pause in typing before the query counts as loading too
  const loadingNames = !!namesQuery(lookup) && (names.loading || lookup.key !== debounced.key)
  const loading = loadingNames || (allSubs && subs.loading)
  return { groups, loading }
}
