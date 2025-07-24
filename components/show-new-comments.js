import { useCallback, useRef } from 'react'
import { useApolloClient } from '@apollo/client'
import styles from './comment.module.css'
import { COMMENT_DEPTH_LIMIT } from '../lib/constants'
import { commentsViewedAfterComment } from '../lib/new-comments'
import classNames from 'classnames'
import useVisibility from './use-visibility'
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
function traverseNewComments (client, item, onLevel, currentDepth = 1, inSubtree = false) {
  // if we're at the depth limit, stop traversing, we've reached the bottom of the visible thread
  if (currentDepth >= COMMENT_DEPTH_LIMIT) return

  if (item.newComments && item.newComments.length > 0) {
    const dedupedNewComments = dedupeNewComments(item.newComments, item.comments?.comments)

    // being newComments an array of comment ids, we can get their latest version from the cache
    // ensuring that we don't miss any new comments
    const freshNewComments = dedupedNewComments.map(id => {
      // mark all new comments as injected, so we can outline them
      return { ...readCommentsFragment(client, id), injected: true }
    }).filter(Boolean)

    // at each level, we can execute a callback passing the current item's new comments, depth and ID
    onLevel(freshNewComments, currentDepth, item.id)

    // traverse the new comment's new comments
    for (const newComment of freshNewComments) {
      traverseNewComments(client, newComment, onLevel, currentDepth + 1, true)
    }
  }

  // check for new comments in existing children, only if we're in a new comment subtree
  if (inSubtree && item.comments?.comments) {
    for (const child of item.comments.comments) {
      traverseNewComments(client, child, onLevel, currentDepth + 1, true)
    }
  }
}

// recursively processes and displays all new comments
// handles comment injection at each level, respecting depth limits
function injectNewComments (client, item, currentDepth, sort, thread) {
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
  }, currentDepth, thread)
}

// counts all new comments of an item
function countAllNewComments (client, item, currentDepth = 1, thread) {
  let newCommentsCount = 0
  let threadChildren = false

  // count by traversing the comment structure
  traverseNewComments(client, item, (newComments, depth) => {
    newCommentsCount += countNComments(newComments)

    // if we reached a depth greater than 1, the thread's children have new comments
    if (depth > 1 && newComments.length > 0) {
      threadChildren = true
    }
  }, currentDepth, thread)

  return { newCommentsCount, threadChildren }
}

function FloatingComments ({ buttonRef, showNewComments, text }) {
  // show the floating comments button only when we're past the main top level button
  const isButtonVisible = useVisibility(buttonRef, { pastElement: true })

  if (isButtonVisible) return null

  return (
    <span
      className={classNames(styles.floatingComments, 'btn btn-sm btn-info')}
      onClick={() => {
        // show new comments as we scroll up
        showNewComments()
        buttonRef.current?.scrollIntoView({ behavior: 'smooth' })
      }}
    >
      {text}
    </span>
  )
}

// ShowNewComments is a component that dedupes, refreshes and injects newComments into the comments field
export function ShowNewComments ({ topLevel, item, sort, depth = 0 }) {
  const client = useApolloClient()
  const ref = useRef(null)

  // a thread is a top-level comment
  const thread = item.path?.split('.').length === 2

  // recurse through all new comments and their children
  // if the item is a thread, we consider every existing child comment
  const { newCommentsCount, threadChildren } = countAllNewComments(client, item, depth, thread)

  // only if the item is a thread and its children have new comments, we show "show all new comments"
  const threadComment = thread && threadChildren

  const showNewComments = useCallback(() => {
    // a top level comment doesn't pass depth, we pass its default value of 0 to signify this
    // child comments are injected from the depth they're at
    injectNewComments(client, item, depth, sort, threadComment)
  }, [client, sort, item, depth])

  const text = !threadComment
    ? `${newCommentsCount} new comment${newCommentsCount > 1 ? 's' : ''}`
    : 'show all new comments'

  return (
    <>
      <span
        ref={ref}
        onClick={showNewComments}
        className='fw-bold d-flex align-items-center gap-2 px-3 pointer'
        style={{ visibility: newCommentsCount > 0 ? 'visible' : 'hidden' }}
      >
        {text}
        <div className={styles.newCommentDot} />
      </span>
      {topLevel && newCommentsCount > 0 && (
        <FloatingComments buttonRef={ref} showNewComments={showNewComments} text={text} />
      )}
    </>
  )
}
