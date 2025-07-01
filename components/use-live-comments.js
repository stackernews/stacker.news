import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import { GET_NEW_COMMENTS, COMMENT_WITH_NEW } from '../fragments/comments'
import { ITEM_FULL } from '../fragments/items'
import { useEffect, useRef, useState } from 'react'

const POLL_INTERVAL = 1000 * 10 // 10 seconds

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
    if (!data?.newComments) return

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

// the item query is used to update the item's newComments field
export function itemUpdateQuery (client, id, sort, fn) {
  client.cache.updateQuery({
    query: ITEM_FULL,
    // updateQuery needs the correct variables to update the correct item
    // the Item query might have the router.query.sort in the variables, so we need to pass it in if it exists
    variables: sort ? { id, sort } : { id }
  }, (data) => {
    if (!data) return data
    return { item: fn(data.item) }
  })
}

// update the newComments field of a nested comment fragment
export function commentUpdateFragment (client, id, fn) {
  client.cache.updateFragment({
    id: `Item:${id}`,
    fragment: COMMENT_WITH_NEW,
    fragmentName: 'CommentWithNew'
  }, (data) => {
    if (!data) return data
    return fn(data)
  })
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
      // but first check if parent exists in cache before attempting update
      const parentExists = client.cache.readFragment({
        id: `Item:${parentId}`,
        fragment: COMMENT_WITH_NEW,
        fragmentName: 'CommentWithNew'
      })

      if (parentExists) {
        // merge the new comment into the parent comment's newComments field, checking for duplicates
        commentUpdateFragment(client, parentId, (data) => mergeNewComment(data, newComment))
      } else {
        // parent not in cache, queue for retry
        queuedComments.push(newComment)
      }
    }
  }

  return { queuedComments }
}

// merge new comment into item's newComments
// and prevent duplicates by checking if the comment is already in item's newComments or existing comments
function mergeNewComment (item, newComment) {
  const existingNewComments = item.newComments || []
  const existingComments = item.comments?.comments || []

  // is the incoming new comment already in item's new comments or existing comments?
  if (existingNewComments.some(c => c.id === newComment.id) || existingComments.some(c => c.id === newComment.id)) {
    return item
  }

  return { ...item, newComments: [...existingNewComments, newComment] }
}

function getLatestCommentCreatedAt (comments, latest) {
  return comments.reduce(
    (max, { createdAt }) => (createdAt > max ? createdAt : max),
    latest
  )
}
