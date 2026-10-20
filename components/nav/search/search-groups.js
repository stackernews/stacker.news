import { useMemo, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { NAV_SEARCH_NAMES } from '@/fragments/search'
import { userItem, subItem } from './items'

// stackers and territories each, under a search
const SEARCH_LIMIT = 4

function toGroups (data = {}) {
  return [
    { value: 'user', label: 'stackers', items: (data.searchUsers ?? []).map(userItem) },
    // territory post counts need a time range, so these tiles only have the name
    { value: 'sub', label: 'territories', layout: 'tiles', items: (data.subSuggestions ?? []).map(sub => subItem(sub)) }
  ].filter(group => group.items.length > 0)
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
  const withNames = debounced.mode === 'search' && !!debounced.nameQ

  // only the open bar runs the query, there's more than one bar on the page
  const names = useQuery(NAV_SEARCH_NAMES, {
    variables: { q: debounced.nameQ ?? '', withUsers: true, withSubs: true, limit: SEARCH_LIMIT },
    skip: !open || !withNames
  })
  const data = useLastData(names.data, withNames && debounced.mode)
  const groups = useMemo(() => toGroups(data), [data])

  // the pause in typing before the query counts as loading too
  const loading = lookup.mode === 'search' && (names.loading || lookup.key !== debounced.key)
  return { groups, loading }
}
