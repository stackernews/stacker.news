import { useCallback } from 'react'
import { useApolloClient } from '@apollo/client'
import styles from './comment.module.css'
import { COMMENT_DEPTH_LIMIT } from '../lib/constants'
import { commentsViewedAfterComment } from '../lib/new-comments'
import {
  itemUpdateQuery,
  commentUpdateFragment,
  getLatestCommentCreatedAt,
  updateAncestorsCommentCount,
  readCommentsFragment
} from '../lib/comments'

// filters out new comments, by id, that already exist in the item's comments
// preventing duplicate comments from being injected
function dedupeNewComments (newComments, comments = []) {
  const existingIds = new Set(comments.map(c => c.id))
  return newComments.filter(id => !existingIds.has(id))
}

// prepares and creates a new comments fragment for injection into the cache
// returns a function that can be used to update an item's comments field
function prepareComments ({ client, newCommentIds, newComments }) {
  return (data) => {
    // newComments is an array of comment ids that allows us to read the latest newComments from the cache,
    // guaranteeing that we're not reading stale data
    const freshNewComments = newComments || newCommentIds.map(id => {
      return readCommentsFragment(client, id)
    }).filter(Boolean)

    // count total comments being injected: each new comment + all their existing nested comments
    let totalNComments = freshNewComments.length
    for (const comment of freshNewComments) {
      // add all nested comments (subtree) under this newly injected comment to the total
      totalNComments += (comment.ncomments || 0)
    }

    // update all ancestors, but not the item itself
    const ancestors = data.path.split('.').slice(0, -1)
    updateAncestorsCommentCount(client.cache, ancestors, totalNComments)

    // update commentsViewedAt with the most recent fresh new comment
    // quirk: this is not the most recent comment, it's the most recent comment in the freshNewComments array
    //        as such, the next visit will not outline other new comments that have not been injected yet
    const latestCommentCreatedAt = getLatestCommentCreatedAt(freshNewComments, data.createdAt)
    const rootId = data.path.split('.')[0]
    commentsViewedAfterComment(rootId, latestCommentCreatedAt)

    // return the updated item with the new comments injected
    return {
      ...data,
      comments: { ...data.comments, comments: [...freshNewComments, ...data.comments.comments] },
      ncomments: data.ncomments + totalNComments,
      newComments: []
    }
  }
}

// traverses all new comments and their children
// at each level, we can execute a callback giving the new comments and the item
function traverseNewComments (client, item, onLevel, currentDepth = 1) {
  if (currentDepth >= COMMENT_DEPTH_LIMIT) return

  if (item.newComments && item.newComments.length > 0) {
    const dedupedNewComments = dedupeNewComments(item.newComments, item.comments?.comments)
    const freshNewComments = dedupedNewComments.map(id => {
      return readCommentsFragment(client, id)
    }).filter(Boolean)

    onLevel(freshNewComments, item)

    for (const newComment of freshNewComments) {
      traverseNewComments(client, newComment, onLevel, currentDepth + 1)
    }
  }
}

// recursively processes and displays all new comments and its children
// handles comment injection at each level, respecting depth limits
function injectNewComments (client, item, currentDepth = 1) {
  traverseNewComments(client, item, (newComments, item) => {
    if (newComments.length > 0) {
      const payload = prepareComments({ client, newComments })
      commentUpdateFragment(client, item.id, payload)
    }
  }, currentDepth)
}

// counts all new comments for an item and its children
function countAllNewComments (client, item, currentDepth = 1) {
  let totalNComments = 0

  // count by traversing all new comments and their children
  traverseNewComments(client, item, (newComments) => {
    totalNComments += newComments.length
    for (const newComment of newComments) {
      totalNComments += newComment.ncomments || 0
    }
  }, currentDepth)

  return totalNComments
}

// ShowNewComments is a component that dedupes, refreshes and injects newComments into the comments field
export function ShowNewComments ({ topLevel, sort, comments, itemId, item, newComments = [], depth = 1 }) {
  const client = useApolloClient()

  const newCommentIds = topLevel ? dedupeNewComments(newComments, comments) : []
  const newCommentsCount = topLevel ? newCommentIds.length : countAllNewComments(client, item, depth)

  const showNewComments = useCallback(() => {
    if (topLevel) {
      const payload = prepareComments({ client, newCommentIds })
      itemUpdateQuery(client, itemId, sort, payload)
    } else {
      injectNewComments(client, item, depth)
    }
  }, [topLevel, client, itemId, newCommentIds, sort, item, depth])

  if (newCommentsCount === 0) {
    return null
  }

  return (
    <div
      onClick={showNewComments}
      className='fw-bold d-flex align-items-center gap-2 px-3 pointer'
    >
      {newCommentsCount > 1
        ? `${newCommentsCount} new comments`
        : 'show new comment'}
      <div className={styles.newCommentDot} />
    </div>
  )
}
