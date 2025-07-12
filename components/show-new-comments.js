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

// ShowNewComments is a component that dedupes, refreshes and injects newComments into the comments field
export function ShowNewComments ({ topLevel = false, comments, newComments = [], itemId, sort }) {
  const client = useApolloClient()

  const dedupedNewComments = useMemo(() => {
    const existingIds = new Set(comments.map(c => c.id))
    return newComments.filter(id => !existingIds.has(id))
  }, [newComments, comments])

  const showNewComments = useCallback(() => {
    // fetch the latest version of the comments from the cache by their ids
    const payload = prepareComments(client, dedupedNewComments)

    if (topLevel) {
      itemUpdateQuery(client, itemId, sort, payload)
    } else {
      commentUpdateFragment(client, itemId, payload)
    }
  }, [client, itemId, dedupedNewComments, topLevel, sort])

  if (dedupedNewComments.length === 0) {
    return null
  }

  return (
    <div
      onClick={showNewComments}
      className={`${topLevel && `d-block fw-bold ${styles.comment} pb-2`} d-flex align-items-center gap-2 px-3 pointer`}
    >
      {dedupedNewComments.length > 1
        ? `${dedupedNewComments.length} new comments`
        : 'show new comment'}
      <div className={styles.newCommentDot} />
    </div>
  )
}
