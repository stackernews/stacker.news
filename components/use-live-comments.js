import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import { GET_NEW_COMMENTS } from '../fragments/comments'
import { useEffect, useRef, useState } from 'react'
import { itemUpdateQuery, commentUpdateFragment, getLatestCommentCreatedAt } from '../lib/comments'

const POLL_INTERVAL = 1000 * 10 // 10 seconds

// merge new comment into item's newComments
// and prevent duplicates by checking if the comment is already in item's newComments or existing comments
function mergeNewComment (item, newComment) {
  const existingNewComments = item.newComments || []

  // is the incoming new comment already in item's new comments or existing comments?
  if (existingNewComments.includes(newComment.id)) {
    return item
  }

  return { ...item, newComments: [...existingNewComments, newComment.id] }
}

function cacheNewComments (client, rootId, newComments, sort) {
  const queuedComments = []

  for (const newComment of newComments) {
    const { parentId } = newComment
    const topLevel = Number(parentId) === Number(rootId)

    // if the comment is a top level comment, update the item
    if (topLevel) {
      // merge the new comment into the item's newComments field, checking for duplicates
      itemUpdateQuery(client, rootId, sort, (data) => mergeNewComment(data, newComment))
    } else {
      // if the comment is a reply, update the parent comment
      // merge the new comment into the parent comment's newComments field, checking for duplicates
      const result = commentUpdateFragment(client, parentId, (data) => mergeNewComment(data, newComment))

      if (!result) {
        // parent not in cache, queue for retry
        queuedComments.push(newComment)
      }
    }
  }

  return { queuedComments }
}

// useLiveComments fetches new comments under an item (rootId), that arrives after the latest comment createdAt
// and inserts them into the newComment client field of their parent comment/post.
export default function useLiveComments (rootId, after, sort) {
  const client = useApolloClient()
  const [latest, setLatest] = useState(after)
  const queue = useRef([])

  const { data } = useQuery(GET_NEW_COMMENTS, SSR
    ? {}
    : {
        pollInterval: POLL_INTERVAL,
        // only get comments newer than the passed latest timestamp
        variables: { rootId, after: latest },
        nextFetchPolicy: 'cache-and-network'
      })

  useEffect(() => {
    if (!data?.newComments?.comments?.length) return

    // sometimes new comments can arrive as orphans because their parent might not be in the cache yet
    // queue them up, retry until the parent shows up.
    const newComments = [...data.newComments.comments, ...queue.current]
    const { queuedComments } = cacheNewComments(client, rootId, newComments, sort)

    // keep the queued comments for the next poll
    queue.current = queuedComments

    // update latest timestamp to the latest comment created at
    setLatest(prevLatest => getLatestCommentCreatedAt(data.newComments.comments, prevLatest))
  }, [data, client, rootId, sort])

  // cleanup queue on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      queue.current = []
    }
  }, [])
}
