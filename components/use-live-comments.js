import preserveScroll from './preserve-scroll'
import { GET_NEW_COMMENTS } from '../fragments/comments'
import { useEffect, useState } from 'react'
import { SSR, COMMENT_DEPTH_LIMIT } from '../lib/constants'
import { useQuery, useApolloClient } from '@apollo/client'
import { commentsViewedAfterComment } from '../lib/new-comments'
import {
  readItemQuery,
  writeItemQuery,
  readCommentsFragment,
  writeCommentFragment,
  getLatestCommentCreatedAt,
  updateAncestorsCommentCount
} from '../lib/comments'

const POLL_INTERVAL = 1000 * 5 // 5 seconds

// prepares and creates a new comments fragment for injection into the cache
// returns a function that can be used to update an item's comments field
function prepareComments (data, client, newComment) {
  const existingComments = data.comments?.comments || []

  // is the incoming new comment already in item's new comments or existing comments?
  // if so, we don't need to update the cache
  if (existingComments.some(comment => comment.id === newComment.id)) return

  // +1 because the new comment is also a comment
  const totalNComments = newComment.ncomments + 1

  const itemHierarchy = data.path.split('.')
  // update all ancestors comment count, but not the item itself
  const ancestors = itemHierarchy.slice(0, -1)
  updateAncestorsCommentCount(client.cache, ancestors, totalNComments)
  // update commentsViewedAt to now, and add the number of new comments
  const rootId = itemHierarchy[0]
  commentsViewedAfterComment(rootId, Date.now(), totalNComments)

  // add a flag to the new comment to indicate it was injected
  const injectedComment = { ...newComment, injected: true }

  // an item can either have a comments.comments field, or not
  const payload = data.comments
    ? {
        ...data,
        ncomments: data.ncomments + totalNComments,
        comments: {
          ...data.comments,
          comments: [injectedComment, ...data.comments.comments]
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

    if (topLevel) {
      // if the comment is a top level comment, update the item
      const { item } = readItemQuery(client, rootId, sort)
      const updatedItem = prepareComments(item, client, newComment)
      if (updatedItem) {
        preserveScroll(() => writeItemQuery(client, rootId, sort, updatedItem))
      }
    } else {
      // if the comment is a reply, update the parent comment
      // calculate depth by counting path segments from root to parent
      const pathSegments = newComment.path.split('.')
      const rootIndex = pathSegments.indexOf(rootId.toString())
      const parentIndex = pathSegments.indexOf(parentId.toString())

      // depth is the distance from root to parent in the path
      const depth = parentIndex - rootIndex
      // if the comment is too deep, we don't need to update the cache
      if (depth > COMMENT_DEPTH_LIMIT) return

      // inject the new comment into the parent comment's comments field
      const parent = readCommentsFragment(client, parentId)
      const updatedParent = prepareComments(parent, client, newComment)
      if (updatedParent) {
        preserveScroll(() => writeCommentFragment(client, parentId, updatedParent))
      }
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

  useEffect(() => {
    if (!data?.newComments?.comments?.length) return

    // directly inject new comments into the cache, preserving scroll position
    cacheNewComments(client, rootId, data.newComments.comments, sort)

    // update latest timestamp to the latest comment created at
    // save it to session storage, to persist between client-side navigations
    const newLatest = getLatestCommentCreatedAt(data.newComments.comments, latest)
    setLatest(newLatest)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(latestKey, newLatest)
    }
  }, [data, client, rootId, sort, latest])
}
