import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import { GET_NEW_COMMENTS, COMMENT_WITH_NEW } from '../fragments/comments'
import { ITEM_FULL } from '../fragments/items'
import { useEffect, useState } from 'react'
import styles from './comment.module.css'

const POLL_INTERVAL = 1000 * 10 // 10 seconds
const ACTIVITY_TIMEOUT = 1000 * 60 * 30 // 30 minutes
const ACTIVITY_CHECK_INTERVAL = 1000 * 60 // 1 minute

export default function useLiveComments (rootId, after) {
  const client = useApolloClient()
  const [latest, setLatest] = useState(after)
  const [polling, setPolling] = useState(true)
  const [engagedAt, setEngagedAt] = useState(new Date())

  // reset engagedAt when polling is toggled
  useEffect(() => {
    if (polling) {
      setEngagedAt(new Date())
    }
  }, [polling])

  useEffect(() => {
    const checkActivity = () => {
      const now = new Date()
      const timeSinceEngaged = now.getTime() - engagedAt.getTime()
      const isActive = document.visibilityState === 'visible'

      // poll only if the user is active and has been active in the last 30 minutes
      if (timeSinceEngaged < ACTIVITY_TIMEOUT) {
        setPolling(isActive)
      } else {
        setPolling(false)
      }
    }

    // check activity every minute
    const interval = setInterval(checkActivity, ACTIVITY_CHECK_INTERVAL)
    // check activity also on visibility change
    document.addEventListener('visibilitychange', checkActivity)

    return () => {
      // cleanup
      document.removeEventListener('visibilitychange', checkActivity)
      clearInterval(interval)
    }
  }, [engagedAt])

  const { data } = useQuery(GET_NEW_COMMENTS, SSR
    ? {}
    : {
        pollInterval: polling ? POLL_INTERVAL : null,
        variables: { rootId, after: latest }
      })

  useEffect(() => {
    if (!data?.newComments) return

    cacheNewComments(client, rootId, data.newComments.comments)
    // check new comments created after the latest new comment
    setLatest(prevLatest => getLatestCommentCreatedAt(data.newComments.comments, prevLatest))
  }, [data, client, rootId])

  return { polling, setPolling }
}

function cacheNewComments (client, rootId, newComments) {
  for (const newComment of newComments) {
    const { parentId } = newComment
    const topLevel = Number(parentId) === Number(rootId)

    // if the comment is a top level comment, update the item
    if (topLevel) {
      client.cache.updateQuery({
        query: ITEM_FULL,
        variables: { id: rootId }
      }, (data) => {
        if (!data) return data
        // we return the entire item, not just the newComments
        return { item: mergeNewComments(data?.item, newComment) }
      })
    } else {
      // if the comment is a reply, update the parent comment
      client.cache.updateFragment({
        id: `Item:${parentId}`,
        fragment: COMMENT_WITH_NEW,
        fragmentName: 'CommentWithNew'
      }, (data) => {
        if (!data) return data
        // here we return the parent comment with the new comment added
        return mergeNewComments(data, newComment)
      })
    }
  }
}

function mergeNewComments (item, newComment) {
  const existingNewComments = item.newComments || []
  const existingComments = item.comments?.comments || []

  // is the incoming new comment already in item's new comments or existing comments?
  if (existingNewComments.some(c => c.id === newComment.id) || existingComments.some(c => c.id === newComment.id)) {
    return item
  }
  return { ...item, newComments: [...existingNewComments, newComment] }
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

export function ShowNewComments ({ newComments = [], itemId, topLevel = false }) {
  const client = useApolloClient()

  const showNewComments = () => {
    if (topLevel) {
      client.cache.updateQuery({
        query: ITEM_FULL,
        variables: { id: itemId }
      }, (data) => {
        if (!data) return data
        const { item } = data

        return {
          item: {
            ...item,
            comments: dedupeComments(item.comments, newComments),
            newComments: []
          }
        }
      })
    } else {
      client.cache.updateFragment({
        id: `Item:${itemId}`,
        fragment: COMMENT_WITH_NEW,
        fragmentName: 'CommentWithNew'
      }, (data) => {
        if (!data) return data

        return {
          ...data,
          comments: dedupeComments(data.comments, newComments),
          newComments: []
        }
      })
    }
  }

  const dedupeComments = (existingComments = [], newComments = []) => {
    const existingIds = new Set(existingComments.comments?.map(c => c.id))
    const filteredNew = newComments.filter(c => !existingIds.has(c.id))
    return {
      ...existingComments,
      comments: [...filteredNew, ...(existingComments.comments || [])]
    }
  }

  return (
    <span onClick={showNewComments}>
      <div className={!topLevel ? styles.comments : 'pb-2'}>
        <div className={`d-block fw-bold ${styles.comment} pb-2 ps-3 d-flex align-items-center gap-2 pointer`}>
          load new comments
          <div className={styles.newCommentDot} />
        </div>
      </div>
    </span>
  )
}
