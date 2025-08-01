import { useCallback, useEffect } from 'react'
import { useApolloClient } from '@apollo/client'
import { COMMENT_DEPTH_LIMIT } from '../lib/constants'
import { commentsViewedAfterComment } from '../lib/new-comments'
import {
  itemUpdateQuery,
  commentUpdateFragment,
  getLatestCommentCreatedAt,
  updateAncestorsCommentCount,
  readCommentsFragment
} from '../lib/comments'
import preserveScroll from './preserve-scroll'

// filters out new comments, by id, that already exist in the item's comments
// preventing duplicate comments from being injected
function dedupeNewComments (newComments, comments = []) {
  const existingIds = new Set(comments.map(c => c.id))
  return newComments.filter(id => !existingIds.has(id))
}

// of an array of new comments, count each new comment + all their existing comments
function countNComments (newComments) {
  let totalNComments = newComments.length
  for (const comment of newComments) {
    totalNComments += comment.ncomments || 0
  }
  return totalNComments
}

// prepares and creates a new comments fragment for injection into the cache
// returns a function that can be used to update an item's comments field
function prepareComments (data, client, newComments) {
  const totalNComments = countNComments(newComments)

  const itemHierarchy = data.path.split('.')
  const ancestors = itemHierarchy.slice(0, -1)
  const rootId = itemHierarchy[0]

  // update all ancestors, but not the item itself
  updateAncestorsCommentCount(client.cache, ancestors, totalNComments)

  // update commentsViewedAt with the most recent fresh new comment
  // quirk: this is not the most recent comment, it's the most recent comment in the newComments array
  //        as such, the next visit will not outline other new comments that are older than this one.
  const latestCommentCreatedAt = getLatestCommentCreatedAt(newComments, data.createdAt)
  commentsViewedAfterComment(rootId, latestCommentCreatedAt, totalNComments)

  // an item can either have a comments.comments field, or not
  const payload = data.comments
    ? {
        ...data,
        ncomments: data.ncomments + totalNComments,
        newComments: [],
        comments: {
          ...data.comments,
          comments: newComments.concat(data.comments.comments)
        }
      }
    // when the fragment doesn't have a comments field, we just update stats fields
    : {
        ...data,
        ncomments: data.ncomments + totalNComments,
        newComments: []
      }

  return payload
}

// traverses all new comments and their children
// if it's a thread, or we're in a new comment subtree, we also consider their existing children
function traverseNewComments (client, item, onLevel, currentDepth, inSubtree) {
  // if we're at the depth limit, stop traversing, we've reached the bottom of the visible thread
  if (currentDepth >= COMMENT_DEPTH_LIMIT) return

  // if the current item shows less comments than its nDirectComments, it's paginated
  // we don't want to count/inject new comments in paginated items, as they shouldn't be visible
  if (item.comments?.comments?.length < item.nDirectComments) return

  if (item.newComments && item.newComments.length > 0) {
    const dedupedNewComments = dedupeNewComments(item.newComments, item.comments?.comments)

    // being newComments an array of comment ids, we can get their latest version from the cache
    // ensuring that we don't miss any new comments
    const freshNewComments = dedupedNewComments.map(id => {
      const comment = readCommentsFragment(client, id)
      // idempotency: if the comment has already been injected, skip it
      if (comment?.injected) return null
      // mark all new comments as injected, so we can outline them
      return { ...comment, injected: true }
    }).filter(Boolean)

    // at each level, we can execute a callback passing the current item's new comments, depth and ID
    onLevel(freshNewComments, currentDepth, item.id)

    // traverse the new comment's new comments and their children
    for (const newComment of freshNewComments) {
      traverseNewComments(client, newComment, onLevel, currentDepth + 1, true)
    }
  }

  // check for new comments in existing children
  // only if we're in a new comment subtree, or it's a thread
  if (inSubtree && item.comments?.comments) {
    for (const child of item.comments.comments) {
      traverseNewComments(client, child, onLevel, currentDepth + 1, true)
    }
  }
}

// recursively processes and displays all new comments
// handles comment injection at each level, respecting depth limits
function injectNewComments (client, item, sort, currentDepth) {
  traverseNewComments(client, item, (newComments, depth, itemId) => {
    if (newComments.length > 0) {
      // traverseNewComments also passes the depth of the current item
      // used to determine if in an array of new comments, we are injecting topLevels (depth 0) or not
      if (depth === 0) {
        itemUpdateQuery(client, itemId, sort, (data) => prepareComments(data, client, newComments))
      } else {
        commentUpdateFragment(client, itemId, (data) => prepareComments(data, client, newComments))
      }
    }
  }, currentDepth)
}

// ShowNewComments is a component that dedupes, refreshes and injects newComments into the comments field
export function ShowNewComments ({ item, sort, depth = 0 }) {
  const client = useApolloClient()

  const showNewComments = useCallback(() => {
    // a top level comment doesn't pass depth, we pass its default value of 0 to signify this
    // child comments are injected from the depth they're at
    injectNewComments(client, item, sort, depth)
  }, [client, sort, item, depth])

  // auto-show new comments as they arrive
  useEffect(() => {
    if (item.newComments?.length > 0) {
      preserveScroll(showNewComments)
    }
  }, [item.newComments?.length])
}
