import preserveScroll from './preserve-scroll'
import { GET_NEW_COMMENTS } from '../fragments/comments'
import { UPDATE_ITEM_USER_VIEW } from '../fragments/items'
import { useEffect, useState, useCallback } from 'react'
import { SSR, COMMENT_DEPTH_LIMIT, USER_ID } from '../lib/constants'
import { useQuery, useApolloClient, useMutation } from '@apollo/client'
import { commentsViewedAfterComment } from '../lib/new-comments'
import {
  updateItemQuery,
  updateCommentFragment,
  updateAncestorsCommentCount,
  calculateDepth
} from '../lib/comments'
import { useMe } from './me'
import { useRoot } from './root'

const POLL_INTERVAL = 1000 * 5 // 5 seconds

// prepares and creates a fragment for injection into the cache
// also handles side effects like updating comment counts and viewedAt timestamps
function prepareComments (item, cache, newComment) {
  const existingComments = item.comments?.comments || []

  // is the incoming new comment already in item's existing comments?
  // if so, we don't need to update the cache
  if (existingComments.some(comment => comment.id === newComment.id)) return item

  // count the new comment (+1) and its children (+ncomments)
  const totalNComments = newComment.ncomments + 1

  const itemHierarchy = item.path.split('.')
  // update all ancestors comment count, but not the item itself
  const ancestors = itemHierarchy.slice(0, -1)
  updateAncestorsCommentCount(cache, ancestors, totalNComments)

  // add a flag to the new comment to indicate it was injected
  const injectedComment = { ...newComment, injected: true }

  // an item can either have a comments.comments field, or not
  const payload = item.comments
    ? {
        ...item,
        ncomments: item.ncomments + totalNComments,
        nDirectComments: item.nDirectComments + 1,
        comments: {
          ...item.comments,
          comments: [injectedComment, ...item.comments.comments]
        }
      }
    // when the fragment doesn't have a comments field, we just update stats fields
    : {
        ...item,
        ncomments: item.ncomments + totalNComments,
        nDirectComments: item.nDirectComments + 1
      }

  return payload
}

function checkOwnership (me, newComment) {
  // is this mine?
  if (Number(newComment.user.id) !== Number(me?.id ?? USER_ID.anon)) return false

  if (newComment.invoice) {
    // pessimistic
    return window.sessionStorage.getItem(`invoice:${newComment.invoice.id}:mine`)
  } else {
    // optimistic
    return window.sessionStorage.getItem(`item:${newComment.id}:mine`)
  }
}

function cacheNewComments (cache, latest, topLevelId, newComments, sort, me) {
  let injectedLatest = latest
  for (const newComment of newComments) {
    // this is used to prevent live comments from injecting the comment we just created
    const mine = checkOwnership(me, newComment)
    if (mine && new Date(newComment.createdAt).getTime() > new Date(injectedLatest).getTime()) {
      // don't inject this comment but bump the latest timestamp
      injectedLatest = newComment.createdAt
      continue
    }

    const { parentId } = newComment
    const topLevel = Number(parentId) === Number(topLevelId)
    let injected = false

    // if the comment is a top level comment, update the item, else update the parent comment
    if (topLevel) {
      updateItemQuery(cache, topLevelId, sort, (item) => prepareComments(item, cache, newComment))
      injected = true
    } else {
      // if the comment is too deep, we can skip it
      const depth = calculateDepth(newComment.path, topLevelId, parentId)
      if (depth > COMMENT_DEPTH_LIMIT) continue
      // inject the new comment into the parent comment's comments field
      const updated = updateCommentFragment(cache, parentId, (parent) => prepareComments(parent, cache, newComment))
      injected = !!updated
    }

    // update latest timestamp to the latest comment created at
    if (injected && new Date(newComment.createdAt).getTime() > new Date(injectedLatest).getTime()) {
      injectedLatest = newComment.createdAt
    }
  }

  return injectedLatest
}

// useLiveComments fetches new comments under an item (topLevelId),
// that are newer than the latest comment createdAt (after), and injects them into the cache.
export default function useLiveComments (topLevelId, after, sort) {
  const latestKey = `liveCommentsLatest:${topLevelId}`
  const { cache } = useApolloClient()
  const { me } = useMe()
  const root = useRoot()
  const [updateCommentsViewAt] = useMutation(UPDATE_ITEM_USER_VIEW, {
    update (cache, { data: { updateCommentsViewAt } }) {
      cache.modify({
        id: `Item:${root.id}`,
        fields: { meCommentsViewedAt: () => updateCommentsViewAt }
      })
    }
  })
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
      injectedLatest = cacheNewComments(cache, injectedLatest, topLevelId, data.newComments.comments, sort, me)
    })

    // sync view time if we successfully injected new comments
    if (new Date(injectedLatest).getTime() > new Date(latest).getTime()) {
      if (me?.id) {
        // server-tracked view
        updateCommentsViewAt({ variables: { id: root.id, meCommentsViewedAt: injectedLatest } })
      } else {
        // anon fallback
        commentsViewedAfterComment(root.id, injectedLatest)
      }

      // update latest timestamp to the latest comment created at
      // save it to session storage, to persist between client-side navigations
      setLatest(injectedLatest)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(latestKey, injectedLatest)
      }
    }
  }, [data, cache, topLevelId, root.id, sort, latest, me?.id])
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
