import { useCallback, useMemo } from 'react'
import { useApolloClient } from '@apollo/client'
import styles from './comment.module.css'
import { itemUpdateQuery, commentUpdateFragment } from './use-live-comments'
import { prepareComments, dedupeNewComments, collectAllNewComments, showAllNewCommentsRecursively } from '@/lib/comments'

export const ShowNewComments = ({ topLevel, sort, comments, itemId, item, setHasNewComments, newComments = [], depth = 1 }) => {
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
