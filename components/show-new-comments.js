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

// prepares and creates a new comments fragment for injection into the cache
// returns a function that can be used to update an item's comments field
function prepareComments ({ client, newComments }) {
  return (data) => {
    // count total comments being injected: each new comment + all their existing nested comments
    let totalNComments = newComments.length
    for (const comment of newComments) {
      // add all nested comments (subtree) under this newly injected comment to the total
      totalNComments += (comment.ncomments || 0)
    }

    // update all ancestors, but not the item itself
    const ancestors = data.path.split('.').slice(0, -1)
    updateAncestorsCommentCount(client.cache, ancestors, totalNComments)

    // update commentsViewedAt with the most recent fresh new comment
    // quirk: this is not the most recent comment, it's the most recent comment in the newComments array
    //        as such, the next visit will not outline other new comments that are older than this one.
    const latestCommentCreatedAt = getLatestCommentCreatedAt(newComments, data.createdAt)
    const rootId = data.path.split('.')[0]
    commentsViewedAfterComment(rootId, latestCommentCreatedAt, totalNComments)

    // standard payload for all types of comment fragments
    const payload = {
      ...data,
      ncomments: data.ncomments + totalNComments,
      newComments: []
    }

    // inject comments for fragments that have a comments field
    if (data.comments) {
      payload.comments = { ...data.comments, comments: [...newComments, ...(data.comments?.comments || [])] }
    }

    // otherwise, just return the standard payload to update the item
    return payload
  }
}

// traverses all new comments and their children
// if we're showing all new comments of a thread, we also consider their existing children
function traverseNewComments (client, item, onLevel, threadComment = false, currentDepth = 1) {
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

    for (const newComment of freshNewComments) {
      traverseNewComments(client, newComment, onLevel, currentDepth + 1)
    }
  }

  // if we're showing all new comments of a thread
  // we consider every child comment recursively
  if (threadComment && item.comments?.comments) {
    for (const child of item.comments.comments) {
      traverseNewComments(client, child, onLevel, threadComment, currentDepth + 1)
    }
  }
}

// recursively processes and displays all new comments
// handles comment injection at each level, respecting depth limits
function injectNewComments (client, item, currentDepth, sort, threadComment = false) {
  traverseNewComments(client, item, (newComments, depth, itemId) => {
    if (newComments.length > 0) {
      const payload = prepareComments({ client, newComments })

      // traverseNewComments also passes the depth of the current item
      // used to determine if in an array of new comments, we are injecting topLevels (depth 0) or not
      if (depth === 0) {
        itemUpdateQuery(client, itemId, sort, payload)
      } else {
        commentUpdateFragment(client, itemId, payload)
      }
    }
  }, threadComment, currentDepth)
}

// counts all new comments of an item
function countAllNewComments (client, item, thread = false, currentDepth = 1) {
  let newCommentsCount = 0
  let threadChildren = false

  // count by traversing the comment structure
  traverseNewComments(client, item, (newComments, depth) => {
    newCommentsCount += newComments.length
    for (const newComment of newComments) {
      newCommentsCount += newComment.ncomments || 0
    }

    // if we reached a depth greater than 1, the thread's children have new comments
    if (depth > 1 && newComments.length > 0) {
      threadChildren = true
    }
  }, thread, currentDepth)

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
  const { newCommentsCount, threadChildren } = countAllNewComments(client, item, thread, depth)

  // only if the item is a thread and its children have new comments, we show "show all new comments"
  const threadComment = thread && threadChildren

  const showNewComments = useCallback(() => {
    // a top level comment doesn't pass depth, we pass its default value of 0 to signify this
    // child comments are injected from the depth they're at
    injectNewComments(client, item, depth, sort, threadComment)
  }, [client, sort, item, depth])

  const text = `${threadComment ? 'show all ' : ''}${newCommentsCount} new comment${newCommentsCount > 1 ? 's' : ''}`

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
