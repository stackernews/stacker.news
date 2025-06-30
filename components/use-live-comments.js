import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import { GET_NEW_COMMENTS, COMMENT_WITH_NEW } from '../fragments/comments'
import { ITEM_FULL } from '../fragments/items'
import { useCallback, useEffect, useState } from 'react'
import styles from './comment.module.css'

const POLL_INTERVAL = 1000 * 10 // 10 seconds

export default function useLiveComments (rootId, after, sort) {
  const client = useApolloClient()
  const [latest, setLatest] = useState(after)
  const [queue, setQueue] = useState([])

  const { data } = useQuery(GET_NEW_COMMENTS, SSR
    ? {}
    : {
        pollInterval: POLL_INTERVAL,
        variables: { rootId, after: latest }
      })

  useEffect(() => {
    if (!data?.newComments) return

    // live comments can be orphans if the parent comment is not in the cache
    // queue them up and retry later, when the parent decides they want the children.
    const allComments = [...queue, ...data.newComments.comments]
    const { queuedComments } = cacheNewComments(client, rootId, allComments, sort)

    // keep the queued comments for the next poll
    setQueue(queuedComments)

    // update latest timestamp to the latest comment created at
    setLatest(prevLatest => getLatestCommentCreatedAt(data.newComments.comments, prevLatest))
  }, [data, client, rootId, sort])
}

// the item query is used to update the item's newComments field
function itemUpdateQuery (client, id, sort, fn) {
  client.cache.updateQuery({
    query: ITEM_FULL,
    variables: sort === 'top' ? { id } : { id, sort }
  }, (data) => {
    if (!data) return data
    return { item: fn(data.item) }
  })
}

function commentUpdateFragment (client, id, fn) {
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
      itemUpdateQuery(client, rootId, sort, (data) => mergeNewComment(data, newComment))
    } else {
      // check if parent exists in cache before attempting update
      const parentExists = client.cache.readFragment({
        id: `Item:${parentId}`,
        fragment: COMMENT_WITH_NEW,
        fragmentName: 'CommentWithNew'
      })

      if (parentExists) {
        // if the comment is a reply, update the parent comment
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
// if the new comment is already in item's newComments or existing comments, do nothing
function mergeNewComment (item, newComment) {
  const existingNewComments = item.newComments || []
  const existingComments = item.comments?.comments || []

  // is the incoming new comment already in item's new comments or existing comments?
  if (existingNewComments.some(c => c.id === newComment.id) || existingComments.some(c => c.id === newComment.id)) {
    return item
  }

  return { ...item, newComments: [...existingNewComments, newComment] }
}

// dedupe comments by id
function dedupeComments (existing = [], incoming = []) {
  const existingIds = new Set(existing.map(c => c.id))
  return [...incoming.filter(c => !existingIds.has(c.id)), ...existing]
}

function getLatestCommentCreatedAt (comments, latest) {
  if (comments.length === 0) return latest

  // timestamp comparison via Math.max on bare timestamps
  // convert all createdAt to timestamps
  const timestamps = comments.map(c => new Date(c.createdAt).getTime())
  // find the latest timestamp
  const maxTimestamp = Math.max(...timestamps, new Date(latest).getTime())
  // convert back to ISO string
  return new Date(maxTimestamp).toISOString()
}

export function ShowNewComments ({ newComments = [], itemId, topLevel = false, sort }) {
  const client = useApolloClient()

  const showNewComments = useCallback(() => {
    const payload = (data) => {
      // fresh newComments
      const freshNewComments = newComments.map(c => client.cache.readFragment({
        id: `Item:${c.id}`,
        fragment: COMMENT_WITH_NEW,
        fragmentName: 'CommentWithNew'
      }))
      return {
        ...data,
        comments: { ...data.comments, comments: dedupeComments(data.comments.comments, freshNewComments) },
        newComments: []
      }
    }

    if (topLevel) {
      itemUpdateQuery(client, itemId, sort, payload)
    } else {
      commentUpdateFragment(client, itemId, payload)
    }
  }, [client, itemId, newComments, topLevel, sort])

  return (
    <div
      onClick={showNewComments}
      className={`${topLevel && `d-block fw-bold ${styles.comment} pb-2`} d-flex align-items-center gap-2 px-3 pointer`}
    >
      show ({newComments.length}) new comments
      <div className={styles.newCommentDot} />
    </div>
  )
}
