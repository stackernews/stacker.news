import { useMemo } from 'react'
import { useQuery } from '@apollo/client/react'
import { ACTIVE_SUBS, TERRITORIES_WEEK } from '@/fragments/subs'
import { recentItem, subItem, weekSubItem } from './items'
import { useRecentSearchEntries, useRecentSubEntries } from './recent'
import { useSearchState } from './state'

const SEARCHES_LIMIT = 3
// one row of tiles on desktop
const TILES_LIMIT = 4

// activeSubs leaves out stopped territories, and nsfw ones unless nsfw mode is on,
// so every territory shown has to be in it
function pickSubs ({ activeSubs = [], weekSubs = [], visitedNames, sub }) {
  const byName = new Map(activeSubs.map(territory => [territory.name, territory]))
  const visited = visitedNames
    .map(name => byName.get(name))
    .filter(territory => territory && territory.name !== sub)
    .slice(0, TILES_LIMIT)

  const showable = territory => territory && !territory.meMuteSub && territory.name !== sub
  const week = weekSubs.filter(territory => territory.nitems > 0 && showable(byName.get(territory.name))).slice(0, TILES_LIMIT)

  return { visited, week }
}

export function useBrowseGroups ({ open }) {
  const { sub } = useSearchState()
  const [searches, clearSearches] = useRecentSearchEntries(open)
  const [visitedNames, clearVisited] = useRecentSubEntries(open)

  const activeSubs = useQuery(ACTIVE_SUBS, { skip: !open, fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' }).data?.activeSubs
  const weekSubs = useQuery(TERRITORIES_WEEK, { skip: !open }).data?.topSubs?.subs

  return useMemo(() => {
    const { visited, week } = pickSubs({ activeSubs, weekSubs, visitedNames, sub })

    return [
      { value: 'recent', label: 'recent', items: searches.slice(0, SEARCHES_LIMIT).map(recentItem), action: { label: 'clear', onClick: clearSearches } },
      { value: 'visited', label: 'recently visited', layout: 'tiles', items: visited.map(subItem), action: { label: 'clear', onClick: clearVisited } },
      { value: 'week', label: 'active this week', href: '/top/territories/week?by=items', layout: 'tiles', items: week.map(weekSubItem), action: { label: 'all territories', prefix: '~' } }
    ].filter(group => group.items.length > 0)
  }, [activeSubs, weekSubs, visitedNames, sub, searches, clearSearches, clearVisited])
}
