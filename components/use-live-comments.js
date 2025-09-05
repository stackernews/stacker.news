import { useEffect, useState, useCallback } from 'react'
import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import preserveScroll from './preserve-scroll'
import { GET_NEW_COMMENTS } from '../fragments/comments'
import { injectComment } from '../lib/comments'
import { useMe } from './me'
import useCommentsView from './use-comments-view'

// live comments polling interval
const POLL_INTERVAL = 1000 * 5
// live comments toggle keys
const STORAGE_DISABLE_KEY = 'disableLiveComments'
const TOGGLE_EVENT = 'liveComments:toggle'

const readStoredLatest = (key, latest) => {
  const stored = window.sessionStorage.getItem(key)
  return stored && stored > latest ? stored : latest
}

// cache new comments and return the most recent timestamp between current latest and new comment
function cacheNewComments (cache, latest, itemId, newComments, markViewedAt) {
  return newComments.reduce((latestTimestamp, newComment) => {
    const injected = injectComment(cache, itemId, newComment, { live: true, markViewedAt })
    return injected && new Date(newComment.createdAt) > new Date(latestTimestamp)
      ? newComment.createdAt
      : latestTimestamp
  }, latest)
}

// fetches comments for an item that are newer than the latest comment createdAt (after),
// injects them into cache, and keeps scroll position stable.
export default function useLiveComments (itemId, after) {
  const latestKey = `liveCommentsLatest:${itemId}`
  const { cache } = useApolloClient()
  const { me } = useMe()
  const markViewedAt = useCommentsView()
  const [disableLiveComments] = useLiveCommentsToggle()

  const [latest, setLatest] = useState(after)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    setLatest(readStoredLatest(latestKey, after))
    // Apollo might update the cache before the page has fully rendered, causing reads of stale cached data
    // this prevents GET_NEW_COMMENTS from producing results before the page has fully rendered
    setInitialized(true)
  }, [itemId, after])

  const { data } = useQuery(GET_NEW_COMMENTS, {
    pollInterval: POLL_INTERVAL,
    // only get comments newer than the passed latest timestamp
    variables: { itemId, after: latest },
    nextFetchPolicy: 'cache-and-network',
    skip: SSR || !initialized || disableLiveComments
  })

  useEffect(() => {
    const newComments = data?.newComments?.comments
    if (!newComments?.length) return

    // directly inject new comments into the cache, preserving scroll position
    // quirk: scroll is preserved even if we are not injecting new comments due to dedupe
    const injectedLatest = preserveScroll(() => cacheNewComments(cache, latest, itemId, newComments, markViewedAt))

    // if no new comments were injected, bail
    if (new Date(injectedLatest).getTime() <= new Date(latest).getTime()) return

    // update latest timestamp to the latest comment created at
    // save it to session storage, to persist between client-side navigations
    setLatest(injectedLatest)
    window.sessionStorage.setItem(latestKey, injectedLatest)
  }, [data, cache, itemId, latest, me?.id])
}

export function useLiveCommentsToggle () {
  const [disableLiveComments, setDisableLiveComments] = useState(false)

  useEffect(() => {
    // preference: local storage
    const read = () => setDisableLiveComments(window.localStorage.getItem(STORAGE_DISABLE_KEY) === 'true')
    read()

    // update across tabs
    const onStorage = e => { if (e.key === STORAGE_DISABLE_KEY) read() }
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
    const current = window.localStorage.getItem(STORAGE_DISABLE_KEY) === 'true'
    window.localStorage.setItem(STORAGE_DISABLE_KEY, !current)
    // trigger local event to update this tab
    window.dispatchEvent(new Event(TOGGLE_EVENT))
  }, [])

  return [disableLiveComments, toggle]
}
