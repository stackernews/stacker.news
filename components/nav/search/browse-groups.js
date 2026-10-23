import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { ACTIVE_SUBS, TOP_TERRITORIES } from '@/fragments/subs'
import { recentItem, subItem } from './items'
import { useRecentSearches, useRecentSubs } from './recent'
import { useSearchState } from './state'

// recent searches shown
const SEARCHES_LIMIT = 3
// territories shown in each group, one row of tiles on desktop
const TILES_LIMIT = 4

// activeSubs leaves out stopped territories, and nsfw ones unless nsfw mode is on,
// so every territory shown has to be in it
function pickSubs ({ activeSubs = [], topSubs = [], visitedNames, sub }) {
  const byName = new Map(activeSubs.map(territory => [territory.name, territory]))
  const visited = visitedNames
    .map(name => byName.get(name))
    .filter(territory => territory && territory.name !== sub)
    .slice(0, TILES_LIMIT)

  // the last group leaves out muted territories and the one we're on
  const showable = territory => territory && !territory.meMuteSub && territory.name !== sub
  const subscribed = activeSubs.filter(territory => territory.meSubscription && showable(territory)).slice(0, TILES_LIMIT)
  const top = topSubs.filter(territory => showable(byName.get(territory.name))).slice(0, TILES_LIMIT)

  return { visited, subscribed, top }
}

// what the bar shows before anything is typed: recent searches, recently
// visited territories, and subscribed territories or the top ones
export function useBrowseGroups ({ open }) {
  const { sub } = useSearchState()
  const { getRecent: getSearches, clearRecent: clearSearches } = useRecentSearches()
  const { getRecent: getVisited } = useRecentSubs()
  const [searches, setSearches] = useState([])
  const [visitedNames, setVisitedNames] = useState([])

  // local storage is read each time the bar opens
  useEffect(() => {
    if (!open) return
    setSearches(getSearches())
    setVisitedNames(getVisited())
  }, [open, getSearches, getVisited])

  const onClear = useCallback(() => {
    clearSearches()
    setSearches([])
  }, [clearSearches])

  // the post form and the sidebar run the same queries, so they're often cached
  const activeSubs = useQuery(ACTIVE_SUBS, { skip: !open }).data?.activeSubs
  const topSubs = useQuery(TOP_TERRITORIES, { skip: !open }).data?.topSubs?.subs

  return useMemo(() => {
    const { visited, subscribed, top } = pickSubs({ activeSubs, topSubs, visitedNames, sub })
    const territories = subscribed.length > 0
      ? { value: 'subscribed', label: 'subscribed', items: subscribed.map(subItem) }
      : { value: 'top', label: 'top territories', items: top.map(subItem) }

    return [
      { value: 'recent', label: 'recent', items: searches.slice(0, SEARCHES_LIMIT).map(recentItem), action: { label: 'clear', onClick: onClear } },
      { value: 'visited', label: 'recently visited', layout: 'tiles', items: visited.map(subItem) },
      { ...territories, layout: 'tiles', action: { label: 'all territories', href: '/top/territories/day' } }
    ].filter(group => group.items.length > 0)
  }, [activeSubs, topSubs, visitedNames, sub, searches, onClear])
}
