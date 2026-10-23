import { useMemo, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { NAV_SEARCH_NAMES } from '@/fragments/search'
import { ACTIVE_SUBS } from '@/fragments/subs'
import { userItem, subItem } from './items'

// stackers and territories each, under a search
const SEARCH_LIMIT = 4
// the matches of an @name or a ~name
const NAMES_LIMIT = 8

function toGroups ({ users = [], subs = [] }) {
  return [
    { value: 'user', label: 'stackers', items: users.map(userItem) },
    { value: 'sub', label: 'territories', layout: 'tiles', items: subs.map(subItem) }
  ].filter(group => group.items.length > 0)
}

// the variables of NAV_SEARCH_NAMES for a lookup, undefined when there's nothing to ask
function namesQuery (lookup) {
  if (lookup.mode === 'name') {
    // an @ or a ~ without a name has nothing to look up
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
  if (last.kind !== kind || last.data !== current) setLast({ kind, data: current })
  return current
}

// the stackers and territories whose names match what's typed, in groups with
// the item type as value
export function useSearchGroups ({ lookup, debounced, open }) {
  const variables = namesQuery(debounced)

  // the queries run only while the bar is open
  const names = useQuery(NAV_SEARCH_NAMES, { variables, skip: !open || !variables })
  const data = useLastData(names.data, variables && (debounced.type ?? 'search'))
  const subs = useQuery(ACTIVE_SUBS, { skip: !open })

  // stackers looked up by name don't belong under a search, and the other way around
  const sameLookup = debounced.mode === lookup.mode && debounced.type === lookup.type
  const matches = sameLookup ? data : undefined
  // a ~ alone shows every territory, and so does a ~name until its matches arrive
  const allSubs = lookup.type === 'sub' && (!lookup.name || !matches)

  const groups = useMemo(() => {
    if (allSubs) return toGroups({ subs: subs.data?.activeSubs })
    return toGroups({ users: matches?.searchUsers, subs: matches?.subSuggestions })
  }, [allSubs, subs.data, matches])

  // the pause in typing before the query counts as loading too
  const loadingNames = !!namesQuery(lookup) && (names.loading || lookup.key !== debounced.key)
  const loading = loadingNames || (allSubs && subs.loading)
  return { groups, loading }
}
