import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { ACTIVE_SUBS, TOP_TERRITORIES } from '@/fragments/subs'
import { recentItem, subItem } from './items'
import { useRecentSearches, useRecentSubs } from './recent'
import { useSearchState } from './state'

const SEARCHES_LIMIT = 3
// one row of tiles on desktop
const TILES_LIMIT = 4

// activeSubs leaves out stopped territories, and nsfw ones unless nsfw mode is on,
// so every territory shown has to be in it
function pickSubs ({ activeSubs = [], topSubs = [], visitedNames, sub }) {
  const byName = new Map(activeSubs.map(territory => [territory.name, territory]))
  const visited = visitedNames
    .map(name => byName.get(name))
    .filter(territory => territory && territory.name !== sub)
    .slice(0, TILES_LIMIT)

  const showable = territory => territory && !territory.meMuteSub && territory.name !== sub
  const top = topSubs.filter(territory => showable(byName.get(territory.name))).slice(0, TILES_LIMIT)

  return { visited, top }
}

export function useBrowseGroups ({ open }) {
  const { sub } = useSearchState()
  const { getRecent: getSearches, clearRecent: clearSearches } = useRecentSearches()
  const { getRecent: getVisited } = useRecentSubs()
  const [searches, setSearches] = useState([])
  const [visitedNames, setVisitedNames] = useState([])

  useEffect(() => {
    if (!open) return
    setSearches(getSearches())
    setVisitedNames(getVisited())
  }, [open, getSearches, getVisited])

  const onClear = useCallback(() => {
    clearSearches()
    setSearches([])
  }, [clearSearches])

  const activeSubs = useQuery(ACTIVE_SUBS, { skip: !open, fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' }).data?.activeSubs
  const topSubs = useQuery(TOP_TERRITORIES, { skip: !open }).data?.topSubs?.subs

  return useMemo(() => {
    const { visited, top } = pickSubs({ activeSubs, topSubs, visitedNames, sub })

    return [
      { value: 'recent', label: 'recent', items: searches.slice(0, SEARCHES_LIMIT).map(recentItem), action: { label: 'clear', onClick: onClear } },
      { value: 'visited', label: 'recently visited', layout: 'tiles', items: visited.map(subItem) },
      { value: 'top', label: 'top territories', layout: 'tiles', items: top.map(subItem), action: { label: 'all territories', href: '/top/territories/day' } }
    ].filter(group => group.items.length > 0)
  }, [activeSubs, topSubs, visitedNames, sub, searches, onClear])
}
