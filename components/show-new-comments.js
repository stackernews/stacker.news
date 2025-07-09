import { useCallback, useMemo } from 'react'
import { useApolloClient } from '@apollo/client'
import { COMMENT_WITH_NEW_RECURSIVE } from '../fragments/comments'
import styles from './comment.module.css'
import { itemUpdateQuery, commentUpdateFragment } from './use-live-comments'
import { updateAncestorsCommentCount } from '@/lib/comments'

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

function showAllNewCommentsRecursively (client, item) {
  // handle new comments at this item level
  if (item.newComments && item.newComments.length > 0) {
    const dedupedNewComments = dedupeNewComments(item.newComments, item.comments?.comments)

    if (dedupedNewComments.length > 0) {
      const payload = prepareComments(client, dedupedNewComments)
      commentUpdateFragment(client, item.id, payload)
    }
  }

  // recursively handle new comments in child comments
  if (item.comments?.comments) {
    for (const childComment of item.comments.comments) {
      showAllNewCommentsRecursively(client, childComment)
    }
  }
}

function dedupeNewComments (newComments, comments) {
  const existingIds = new Set(comments.map(c => c.id))
  return newComments.filter(id => !existingIds.has(id))
}

function collectAllNewComments (item) {
  const allNewComments = [...(item.newComments || [])]
  if (item.comments?.comments) {
    for (const comment of item.comments.comments) {
      allNewComments.push(...collectAllNewComments(comment))
    }
  }
  return allNewComments
}

export function ShowNewComments ({ sort, comments, newComments = [], itemId, item, setHasNewComments }) {
  const client = useApolloClient()

  const topLevel = !!sort
  // if item is provided, we're showing all new comments for a thread,
  // otherwise we're showing new comments for a comment
  const isThread = !!item
  const allNewComments = useMemo(() => {
    if (isThread) {
      return collectAllNewComments(item)
    }
    return dedupeNewComments(newComments, comments)
  }, [isThread, item, newComments, comments])

  const showNewComments = useCallback(() => {
    if (isThread) {
      showAllNewCommentsRecursively(client, item)
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
