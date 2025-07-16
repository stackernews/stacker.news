import { useCallback, useMemo } from 'react'
import { useApolloClient } from '@apollo/client'
import styles from './comment.module.css'
import { COMMENT_DEPTH_LIMIT } from '../lib/constants'
import { COMMENT_WITH_NEW_RECURSIVE, COMMENT_WITH_NEW_LIMITED } from '../fragments/comments'
import { commentsViewedAfterComment } from '../lib/new-comments'
import {
  itemUpdateQuery,
  commentUpdateFragment,
  getLatestCommentCreatedAt,
  updateAncestorsCommentCount
} from '../lib/comments'

// filters out new comments, by id, that already exist in the item's comments
// preventing duplicate comments from being injected
function dedupeNewComments (newComments, comments = []) {
  const existingIds = new Set(comments.map(c => c.id))
  return newComments.filter(id => !existingIds.has(id))
}

// prepares and creates a new comments fragment for injection into the cache
// returns a function that can be used to update an item's comments field
function prepareComments (client, newComments) {
  return (data) => {
    // newComments is an array of comment ids that allows us to read the latest newComments from the cache,
    // guaranteeing that we're not reading stale data
    const freshNewComments = newComments.map(id => {
      const fragment = client.cache.readFragment({
        id: `Item:${id}`,
        fragment: COMMENT_WITH_NEW_RECURSIVE,
        fragmentName: 'CommentWithNewRecursive'
      })

      if (!fragment) {
        return null
      }

      return fragment
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

// recursively processes and displays all new comments for a thread
// handles comment injection at each level, respecting depth limits
function showAllNewCommentsRecursively (client, item, currentDepth = 1) {
  if (item.newComments && item.newComments.length > 0) {
    const dedupedNewComments = dedupeNewComments(item.newComments, item.comments?.comments)

    if (dedupedNewComments.length > 0) {
      // handle new comments at this item level only
      const payload = prepareComments(client, dedupedNewComments)
      commentUpdateFragment(client, item.id, payload)
    }
  }

  // read the updated item from the cache
  // this is necessary because the item may have been updated by the time we get to the child comments
  // comments nearing the depth limit lack the recursive structure, so we also need to read the limited fragment
  const updatedItem = client.cache.readFragment({
    id: `Item:${item.id}`,
    fragment: COMMENT_WITH_NEW_RECURSIVE,
    fragmentName: 'CommentWithNewRecursive'
  }) || client.cache.readFragment({
    id: `Item:${item.id}`,
    fragment: COMMENT_WITH_NEW_LIMITED,
    fragmentName: 'CommentWithNewLimited'
  })

  // recursively handle new comments in child comments
  if (updatedItem?.comments?.comments && currentDepth < (COMMENT_DEPTH_LIMIT - 1)) {
    for (const childComment of updatedItem.comments.comments) {
      showAllNewCommentsRecursively(client, childComment, currentDepth + 1)
    }
  }
}

// recursively collects all new comments from an item and its children
// by respecting the depth limit, we avoid collecting new comments to inject in places
// that are too deep in the tree
export function collectAllNewComments (item, currentDepth = 1) {
  let allNewComments = [...(item.newComments || [])]

  // dedupe against the existing comments at this level
  if (item.comments?.comments) {
    allNewComments = dedupeNewComments(allNewComments, item.comments.comments)

    if (currentDepth < (COMMENT_DEPTH_LIMIT - 1)) {
      for (const comment of item.comments.comments) {
        allNewComments.push(...collectAllNewComments(comment, currentDepth + 1))
      }
    }
  }

  return allNewComments
}

// ShowNewComments is a component that dedupes, refreshes and injects newComments into the comments field
export function ShowNewComments ({ topLevel, sort, comments, itemId, item, newComments = [], depth = 1 }) {
  const client = useApolloClient()

  const allNewComments = useMemo(() => {
    if (!topLevel) {
      return collectAllNewComments(item, depth)
    }
    return dedupeNewComments(newComments, comments)
  }, [newComments, comments, item, depth, topLevel])

  const showNewComments = useCallback(() => {
    if (topLevel) {
      const payload = prepareComments(client, allNewComments)
      itemUpdateQuery(client, itemId, sort, payload)
    } else {
      showAllNewCommentsRecursively(client, item, depth)
    }
  }, [client, itemId, allNewComments, topLevel, sort, item, depth])

  if (allNewComments.length === 0) {
    return null
  }

  return (
    <div
      onClick={showNewComments}
      className={`${topLevel && `d-block fw-bold ${styles.comment} pb-2`} d-flex align-items-center gap-2 px-3 pointer`}
    >
      {allNewComments.length > 1
        ? `${allNewComments.length} new comments`
        : 'show new comment'}
      <div className={styles.newCommentDot} />
    </div>
  )
}
