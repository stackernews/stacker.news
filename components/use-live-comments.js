import preserveScroll from './preserve-scroll'
import { GET_NEW_COMMENTS } from '../fragments/comments'
import { useEffect, useState, useCallback } from 'react'
import { SSR } from '../lib/constants'
import { useQuery, useApolloClient } from '@apollo/client'
import { injectComments } from '../lib/comments'
import { useMe } from './me'
import useCommentsView from './use-comments-view'

const POLL_INTERVAL = 1000 * 5 // 5 seconds

function cacheNewComments (cache, latest, newComments) {
  return newComments.reduce((latestTimestamp, newComment) => {
    const commentCreatedAt = injectComments(cache, newComment, { injected: true })

    // return the most recent timestamp between current latest and new comment
    return new Date(commentCreatedAt) > new Date(latestTimestamp)
      ? commentCreatedAt
      : latestTimestamp
  }, latest)
}

// useLiveComments fetches new comments under an item (topLevelId),
// that are newer than the latest comment createdAt (after), and injects them into the cache.
export default function useLiveComments (topLevelId, after) {
  const latestKey = `liveCommentsLatest:${topLevelId}`
  const { cache } = useApolloClient()
  const { me } = useMe()
  const markViewedAt = useCommentsView()
  const [disableLiveComments] = useLiveCommentsToggle()
  const [latest, setLatest] = useState(after)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const storedLatest = window.sessionStorage.getItem(latestKey)
    if (storedLatest && storedLatest > after) {
      setLatest(storedLatest)
    } else {
      setLatest(after)
    }

    // Apollo might update the cache before the page has fully rendered, causing reads of stale cached data
    // this prevents GET_NEW_COMMENTS from producing results before the page has fully rendered
    setInitialized(true)
  }, [topLevelId, after])

  const { data } = useQuery(GET_NEW_COMMENTS, {
    pollInterval: POLL_INTERVAL,
    // only get comments newer than the passed latest timestamp
    variables: { topLevelId, after: latest },
    nextFetchPolicy: 'cache-and-network',
    skip: SSR || !initialized || disableLiveComments
  })

  useEffect(() => {
    if (!data?.newComments?.comments?.length) return

    // directly inject new comments into the cache, preserving scroll position
    // quirk: scroll is preserved even if we are not injecting new comments due to dedupe
    let injectedLatest = latest
    preserveScroll(() => {
      injectedLatest = cacheNewComments(cache, injectedLatest, data.newComments.comments)
    })

    // sync view time if we successfully injected new comments
    if (new Date(injectedLatest).getTime() > new Date(latest).getTime()) {
      // sync view time
      markViewedAt(injectedLatest)

      // update latest timestamp to the latest comment created at
      // save it to session storage, to persist between client-side navigations
      setLatest(injectedLatest)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(latestKey, injectedLatest)
      }
    }
  }, [data, cache, topLevelId, latest, me?.id])
}

const STORAGE_KEY = 'disableLiveComments'
const TOGGLE_EVENT = 'liveComments:toggle'

export function useLiveCommentsToggle () {
  const [disableLiveComments, setDisableLiveComments] = useState(false)

  useEffect(() => {
    // preference: local storage
    const read = () => setDisableLiveComments(window.localStorage.getItem(STORAGE_KEY) === 'true')
    read()

    // update across tabs
    const onStorage = e => { if (e.key === STORAGE_KEY) read() }
    // update this tab
    const onToggle = () => read()

    window.addEventListener('storage', onStorage)
    window.addEventListener(TOGGLE_EVENT, onToggle)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(TOGGLE_EVENT, onToggle)
    }
  }, [])

  const toggle = useCallback(() => {
    const current = window.localStorage.getItem(STORAGE_KEY) === 'true'

    window.localStorage.setItem(STORAGE_KEY, !current)
    // trigger local event to update this tab
    window.dispatchEvent(new Event(TOGGLE_EVENT))
  }, [disableLiveComments])

  return [disableLiveComments, toggle]
}
