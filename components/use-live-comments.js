import { useQuery, useApolloClient } from '@apollo/client'
import { SSR, COMMENT_DEPTH_LIMIT } from '../lib/constants'
import { GET_NEW_COMMENTS } from '../fragments/comments'
import { useEffect, useState, useCallback } from 'react'
import { itemUpdateQuery, commentUpdateFragment, getLatestCommentCreatedAt, updateAncestorsCommentCount } from '../lib/comments'
import { commentsViewedAfterComment } from '../lib/new-comments'
import preserveScroll from './preserve-scroll'

const POLL_INTERVAL = 1000 * 10 // 10 seconds

// prepares and creates a new comments fragment for injection into the cache
// returns a function that can be used to update an item's comments field
function prepareComments (data, client, newComment) {
  const existingComments = data.comments?.comments || []

  // is the incoming new comment already in item's new comments or existing comments?
  if (existingComments.some(comment => comment.id === newComment.id)) {
    return data
  }

  // +1 because the new comment is also a comment
  const totalNComments = newComment.ncomments + 1

  const itemHierarchy = data.path.split('.')
  // update all ancestors comment count, but not the item itself
  const ancestors = itemHierarchy.slice(0, -1)
  updateAncestorsCommentCount(client.cache, ancestors, totalNComments)
  // update commentsViewedAt to now, and add the number of new comments
  const rootId = itemHierarchy[0]
  commentsViewedAfterComment(rootId, Date.now(), totalNComments)

  // an item can either have a comments.comments field, or not
  const payload = data.comments
    ? {
        ...data,
        ncomments: data.ncomments + totalNComments,
        comments: {
          ...data.comments,
          comments: [newComment, ...data.comments.comments]
        }
      }
    // when the fragment doesn't have a comments field, we just update stats fields
    : {
        ...data,
        ncomments: data.ncomments + totalNComments
      }

  return payload
}

function cacheNewComments (client, rootId, newComments, sort) {
  for (const newComment of newComments) {
    const { parentId } = newComment
    const topLevel = Number(parentId) === Number(rootId)

    // add a flag to the new comment to indicate it was injected
    const injectedComment = { ...newComment, injected: true }

    // if the comment is a top level comment, update the item
    if (topLevel) {
      // inject the new comment into the item's comments field
      itemUpdateQuery(client, rootId, sort, (data) => prepareComments(data, client, injectedComment))
    } else {
      // calculate depth by counting path segments from root to parent
      const pathSegments = newComment.path.split('.')
      const rootIndex = pathSegments.indexOf(rootId.toString())
      const parentIndex = pathSegments.indexOf(parentId.toString())

      // depth is the distance from root to parent in the path
      const depth = parentIndex - rootIndex
      if (depth > COMMENT_DEPTH_LIMIT) return

      // if the comment is a reply, update the parent comment
      // inject the new comment into the parent comment's comments field
      commentUpdateFragment(client, parentId, (data) => prepareComments(data, client, injectedComment))
    }
  }
}

// useLiveComments fetches new comments under an item (rootId),
// that are newer than the latest comment createdAt (after), and caches them in the cache.
export default function useLiveComments (rootId, after, sort) {
  const latestKey = `liveCommentsLatest:${rootId}`
  const client = useApolloClient()
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

  const { data } = useQuery(GET_NEW_COMMENTS, SSR || !initialized
    ? {}
    : {
        pollInterval: POLL_INTERVAL,
        // only get comments newer than the passed latest timestamp
        variables: { rootId, after: latest },
        nextFetchPolicy: 'cache-and-network'
      })

  const injectNewComments = useCallback(() => {
    cacheNewComments(client, rootId, data?.newComments?.comments, sort)
  }, [client, rootId, sort, data])

  useEffect(() => {
    if (!data?.newComments?.comments?.length) return

    // directly inject new comments into the cache, preserving scroll position
    preserveScroll(injectNewComments)

    // update latest timestamp to the latest comment created at
    // save it to session storage, to persist between client-side navigations
    const newLatest = getLatestCommentCreatedAt(data.newComments.comments, latest)
    setLatest(newLatest)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(latestKey, newLatest)
    }
  }, [data, client, rootId, sort, latest])
}
