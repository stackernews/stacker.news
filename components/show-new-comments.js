import { useCallback, useMemo } from 'react'
import { useApolloClient } from '@apollo/client'
import { COMMENT_WITH_NEW_RECURSIVE } from '../fragments/comments'
import styles from './comment.module.css'
import { itemUpdateQuery, commentUpdateFragment } from './use-live-comments'
import { updateAncestorsCommentCount } from '@/lib/comments'
import { COMMENT_DEPTH_LIMIT } from '@/lib/constants'

function prepareComments (client, newComments) {
  return (data) => {
    // newComments is an array of comment ids that allows us
    // to read the latest newComments from the cache, guaranteeing that we're not reading stale data
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

    // count the total number of new comments including its nested new comments
    let totalNComments = freshNewComments.length
    for (const comment of freshNewComments) {
      totalNComments += (comment.ncomments || 0)
    }

    // update all ancestors, but not the item itself
    const ancestors = data.path.split('.').slice(0, -1)
    updateAncestorsCommentCount(client.cache, ancestors, totalNComments)

    return {
      ...data,
      comments: { ...data.comments, comments: [...freshNewComments, ...data.comments.comments] },
      ncomments: data.ncomments + totalNComments,
      newComments: []
    }
  }
}

function showAllNewCommentsRecursively (client, item, currentDepth = 1) {
  // handle new comments at this item level
  if (item.newComments && item.newComments.length > 0) {
    const dedupedNewComments = dedupeNewComments(item.newComments, item.comments?.comments)

    if (dedupedNewComments.length > 0) {
      const payload = prepareComments(client, dedupedNewComments)
      commentUpdateFragment(client, item.id, payload)
    }
  }

  // recursively handle new comments in child comments
  if (item.comments?.comments && currentDepth < (COMMENT_DEPTH_LIMIT - 1)) {
    for (const childComment of item.comments.comments) {
      showAllNewCommentsRecursively(client, childComment, currentDepth + 1)
    }
  }
}

function dedupeNewComments (newComments, comments) {
  const existingIds = new Set(comments.map(c => c.id))
  return newComments.filter(id => !existingIds.has(id))
}

function collectAllNewComments (item, currentDepth = 1) {
  const allNewComments = [...(item.newComments || [])]
  if (item.comments?.comments && currentDepth < (COMMENT_DEPTH_LIMIT - 1)) {
    for (const comment of item.comments.comments) {
      console.log('comment', comment)
      console.log('currentDepth', currentDepth)
      allNewComments.push(...collectAllNewComments(comment, currentDepth + 1))
    }
  }
  return allNewComments
}

export function ShowNewComments ({ topLevel, sort, comments, itemId, item, setHasNewComments, newComments = [], depth = 1 }) {
  const client = useApolloClient()

  // if item is provided, we're showing all new comments for a thread,
  // otherwise we're showing new comments for a comment
  const isThread = !topLevel && item?.path.split('.').length === 2
  const allNewComments = useMemo(() => {
    if (isThread) {
      // TODO: well are we only collecting all new comments just for a fancy UI?
      return collectAllNewComments(item, depth)
    }
    return dedupeNewComments(newComments, comments)
  }, [isThread, item, newComments, comments, depth])

  const showNewComments = useCallback(() => {
    if (isThread) {
      showAllNewCommentsRecursively(client, item, depth)
    } else {
      // fetch the latest version of the comments from the cache by their ids
      const payload = prepareComments(client, allNewComments)
      if (topLevel) {
        itemUpdateQuery(client, itemId, sort, payload)
      } else {
        commentUpdateFragment(client, itemId, payload)
      }
    }
    setHasNewComments(false)
  }, [client, itemId, allNewComments, topLevel, sort])

  if (allNewComments.length === 0) {
    return null
  }

  return (
    <div
      onClick={showNewComments}
      className={`${topLevel && `d-block fw-bold ${styles.comment} pb-2`} d-flex align-items-center gap-2 px-3 pointer`}
    >
      {allNewComments.length > 1
        ? `${isThread ? 'show all ' : ''}${allNewComments.length} new comments`
        : 'show new comment'}
      <div className={styles.newCommentDot} />
    </div>
  )
}
