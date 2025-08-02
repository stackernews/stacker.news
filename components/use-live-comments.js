import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import { GET_NEW_COMMENTS } from '../fragments/comments'
import { useEffect, useState, useCallback } from 'react'
import { itemUpdateQuery, commentUpdateFragment, getLatestCommentCreatedAt } from '../lib/comments'
import { useFavicon } from './favicon'
import { useMe } from './me'

const POLL_INTERVAL = 1000 * 10 // 10 seconds

// merge new comment into item's newComments
// and prevent duplicates by checking if the comment is already in item's newComments or existing comments
function mergeNewComment (item, newComment, handleNewComment) {
  const existingNewComments = item.newComments || []
  const existingComments = item.comments?.comments || []

  // is the incoming new comment already in item's new comments or existing comments?
  if (existingNewComments.includes(newComment.id) || existingComments.some(comment => comment.id === newComment.id)) {
    return item
  }

  // new comments side-effects
  handleNewComment(newComment)
  return { ...item, newComments: [...existingNewComments, newComment.id] }
}

function cacheNewComments (client, rootId, newComments, sort, handleNewComment) {
  for (const newComment of newComments) {
    const { parentId } = newComment
    const topLevel = Number(parentId) === Number(rootId)

    // if the comment is a top level comment, update the item
    if (topLevel) {
      // merge the new comment into the item's newComments field, checking for duplicates
      itemUpdateQuery(client, rootId, sort, (data) => mergeNewComment(data, newComment, handleNewComment))
    } else {
      // if the comment is a reply, update the parent comment
      // merge the new comment into the parent comment's newComments field, checking for duplicates
      commentUpdateFragment(client, parentId, (data) => mergeNewComment(data, newComment, handleNewComment))
    }
  }
}

// useLiveComments fetches new comments under an item (rootId), that arrives after the latest comment createdAt
// and inserts them into the newComment client field of their parent comment/post.
export default function useLiveComments (rootId, after, sort) {
  const latestKey = `liveCommentsLatest:${rootId}`
  const client = useApolloClient()
  const { me } = useMe()
  const { setHasNewComments, hasNewComments } = useFavicon()
  const [latest, setLatest] = useState(after)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLatest = window.sessionStorage.getItem(latestKey)
      if (storedLatest && storedLatest > after) {
        setLatest(storedLatest)
      } else {
        setLatest(after)
      }
    }

    // Apollo might update the cache before the page has fully rendered, causing reads of stale cached data
    // this prevents GET_NEW_COMMENTS from producing results before the page has fully rendered
    setInitialized(true)
  }, [after])

  const handleNewComment = useCallback((newComment) => {
    // set the new comments favicon if the deduped comment is not from the current user
    if (me?.id !== newComment.user?.id && !hasNewComments) {
      setHasNewComments(true)
    }
  }, [me?.id, setHasNewComments, hasNewComments])

  const { data } = useQuery(GET_NEW_COMMENTS, SSR || !initialized
    ? {}
    : {
        pollInterval: POLL_INTERVAL,
        // only get comments newer than the passed latest timestamp
        variables: { rootId, after: latest },
        nextFetchPolicy: 'cache-and-network'
      })

  useEffect(() => {
    if (!data?.newComments?.comments?.length) return

    // merge and cache new comments in their parent comment/post
    cacheNewComments(client, rootId, data.newComments.comments, sort, handleNewComment)

    // update latest timestamp to the latest comment created at
    // save it to session storage, to persist between client-side navigations
    const newLatest = getLatestCommentCreatedAt(data.newComments.comments, latest)
    setLatest(newLatest)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(latestKey, newLatest)
    }
  }, [data, client, rootId, sort, latest])

  // reset the new comments favicon when the rootId changes or we leave the page
  useEffect(() => {
    return () => {
      setHasNewComments(false)
    }
  }, [rootId, setHasNewComments])
}
