import { useCallback, useRef, useEffect, useState } from 'react'
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

    // return the updated item with the new comments injected
    return {
      ...data,
      comments: { ...data.comments, comments: [...newComments, ...(data.comments?.comments || [])] },
      ncomments: data.ncomments + totalNComments,
      newComments: []
    }
  }
}

// traverses all new comments and their children
// at each level, we can execute a callback giving the new comments and the item
function traverseNewComments (client, item, onLevel, currentDepth = 1) {
  if (currentDepth > COMMENT_DEPTH_LIMIT) return

  if (item.newComments && item.newComments.length > 0) {
    const dedupedNewComments = dedupeNewComments(item.newComments, item.comments?.comments)

    // being newComments an array of comment ids, we can get their latest version from the cache
    // ensuring that we don't miss any new comments
    const freshNewComments = dedupedNewComments.map(id => {
      // injected is used to determine if we should outline this comment
      return { ...readCommentsFragment(client, id), injected: true }
    }).filter(Boolean)

    // passing currentDepth allows children of top level comments
    // to be updated by the commentUpdateFragment
    onLevel(freshNewComments, item, currentDepth)

    for (const newComment of freshNewComments) {
      traverseNewComments(client, newComment, onLevel, currentDepth + 1)
    }
  }
}

// recursively processes and displays all new comments and its children
// handles comment injection at each level, respecting depth limits
function injectNewComments (client, item, currentDepth, sort) {
  traverseNewComments(client, item, (newComments, item, depth) => {
    if (newComments.length > 0) {
      const payload = prepareComments({ client, newComments })

      // used to determine if by iterating through the new comments
      // we are injecting topLevels (depth 0) or not
      if (depth === 0) {
        itemUpdateQuery(client, item.id, sort, payload)
      } else {
        commentUpdateFragment(client, item.id, payload)
      }
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

function useVisibility (elementRef, threshold = 0) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    // sox notes
    // threshold is the percentage of the element that must be visible to be considered visible
    // 0 means the element must be fully visible, 1 means the element must be fully invisible
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      }, { threshold }
    )

    // track visibility of the element
    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold])

  return isVisible
}

function FloatingComments ({ buttonRef, showNewComments, newCommentsCount }) {
  const isButtonVisible = useVisibility(buttonRef)

  if (newCommentsCount === 0 || isButtonVisible) return null

  return (
    <span
      className='position-fixed top-0 start-50 translate-middle'
      // marginTop is based off the height of the navbar, zIndex is based off the default modal zIndex
      style={{ marginTop: 72, zIndex: 1050 }}
    >
      <button
        className='btn btn-sm btn-info d-flex align-items-center gap-1'
        onClick={() => {
          showNewComments()
          buttonRef.current?.scrollIntoView({ behavior: 'smooth' })
        }}
      >
        {newCommentsCount} new comment{newCommentsCount > 1 ? 's' : ''}
        <div className={styles.newCommentDot} />
      </button>
    </span>
  )
}

// ShowNewComments is a component that dedupes, refreshes and injects newComments into the comments field
export function ShowNewComments ({ topLevel, item, sort, depth = 0 }) {
  const client = useApolloClient()
  const ref = useRef(null)

  // recurse through all new comments and their children
  const newCommentsCount = item.newComments?.length > 0 ? countAllNewComments(client, item, depth) : 0

  const showNewComments = useCallback(() => {
    // a top level comment doesn't have depth, we pass 0 to signify this
    // other comments are injected from their depth
    injectNewComments(client, item, depth, sort)
  }, [client, sort, item, depth])

  return (
    <>
      <span
        ref={ref}
        onClick={showNewComments}
        className='fw-bold d-flex align-items-center gap-2 px-3 pointer'
        style={{ visibility: newCommentsCount > 0 ? 'visible' : 'hidden' }}
      >
        {newCommentsCount} new comment{newCommentsCount > 1 ? 's' : ''}
        <div className={styles.newCommentDot} />
      </span>
      {topLevel && (
        <FloatingComments buttonRef={ref} showNewComments={showNewComments} newCommentsCount={newCommentsCount} />
      )}
    </>
  )
}
