import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import { GET_NEW_COMMENTS, COMMENT_WITH_NEW } from '../fragments/comments'
import { ITEM_FULL } from '../fragments/items'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './comment.module.css'

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
}

// the item query is used to update the item's newComments field
function itemUpdateQuery (client, id, sort, fn) {
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

// even though we already deduplicated comments during the newComments merge
// refetches, client-side navigation, etc. can cause duplicates to appear
// we'll make sure to deduplicate them here, by id
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

// ShowNewComments is a component that dedupes, refreshes and injects newComments into the comments field
export function ShowNewComments ({ newComments = [], itemId, topLevel = false, sort }) {
  const client = useApolloClient()

  const showNewComments = useCallback(() => {
    const payload = (data) => {
      // TODO: it might be sane to pass the cache ref to the ShowNewComments component
      // TODO: and use it to read the latest newComments from the cache
      // newComments can have themselves new comments between the time the button is clicked and the query is executed
      // so we need to read the latest newComments from the cache
      const freshNewComments = newComments.map(c => {
        const fragment = client.cache.readFragment({
          id: `Item:${c.id}`,
          fragment: COMMENT_WITH_NEW,
          fragmentName: 'CommentWithNew'
        })
        // if the comment is not in the cache, return the original comment
        return fragment || c
      })

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
      {newComments.length > 0 ? `${newComments.length} new comments` : 'new comment'}
      <div className={styles.newCommentDot} />
    </div>
  )
}
