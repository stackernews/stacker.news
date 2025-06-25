import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import { GET_NEW_COMMENTS, COMMENT_WITH_NEW } from '../fragments/comments'
import { ITEM_FULL } from '../fragments/items'
import { useEffect, useState } from 'react'
import styles from './comments.module.css'

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
      if (timeSinceEngaged < 1000 * 60 * 30) {
        setPolling(isActive)
      } else {
        setPolling(false)
      }
    }

    // check activity every minute
    const interval = setInterval(checkActivity, 1000 * 60)
    // check activity also on visibility change
    document.addEventListener('visibilitychange', checkActivity)

    return () => {
      document.removeEventListener('visibilitychange', checkActivity)
      clearInterval(interval)
    }
  }, [engagedAt])

  const { data } = useQuery(GET_NEW_COMMENTS, SSR
    ? {}
    : {
        pollInterval: polling ? 10000 : null,
        variables: { rootId, after: latest }
      })

  useEffect(() => {
    if (data && data.newComments) {
      saveNewComments(client, rootId, data.newComments.comments)
      // check new comments created after the latest new comment
      const latestCommentCreatedAt = getLatestCommentCreatedAt(data.newComments.comments, latest)
      if (latestCommentCreatedAt) {
        setLatest(latestCommentCreatedAt)
      }
    }
  }, [data, client, rootId, latest])

  return { polling, setPolling }
}

function saveNewComments (client, rootId, newComments) {
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
        return { item: dedupeComment(data?.item, newComment) }
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
        return dedupeComment(data, newComment)
      })
    }
  }
}

function dedupeComment (item, newComment) {
  const existingNewComments = item.newComments || []
  const existingComments = item.comments?.comments || []

  // is the incoming new comment already in item's new comments or existing comments?
  if (existingNewComments.some(c => c.id === newComment.id) || existingComments.some(c => c.id === newComment.id)) {
    return item
  }
  return { ...item, newComments: [...existingNewComments, newComment] }
}

function getLatestCommentCreatedAt (comments, latest) {
  if (comments.length === 0) return null

  for (const comment of comments) {
    if (comment.createdAt > latest) {
      latest = comment.createdAt
    }
  }

  return latest
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
