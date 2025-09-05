import { useMutation } from '@apollo/client'
import { useCallback } from 'react'
import { UPDATE_ITEM_USER_VIEW } from '@/fragments/items'
import { commentsViewedAfterComment, commentsViewed, newComments } from '@/lib/new-comments'
import { useMe } from './me'
import { useRoot } from './root'

export default function useCommentsView ({ item, updateCache = true } = {}) {
  const { me } = useMe()
  const root = useRoot()
  const itemId = item?.id || root?.id

  const [updateCommentsViewAt] = useMutation(UPDATE_ITEM_USER_VIEW, {
    update (cache, { data: { updateCommentsViewAt } }) {
      if (!updateCache) return

      if (itemId) {
        cache.modify({
          id: `Item:${itemId}`,
          fields: { meCommentsViewedAt: () => updateCommentsViewAt }
        })
      }
    }
  })

  const updateViewedAt = useCallback((id, timestamp, anonFallbackFn) => {
    if (me?.id) {
      updateCommentsViewAt({ variables: { id, meCommentsViewedAt: timestamp } })
    } else {
      anonFallbackFn()
    }
  }, [me?.id, updateCommentsViewAt])

  // update meCommentsViewedAt on comment injection
  const markCommentViewedAt = useCallback((latest, { ncomments } = {}) => {
    updateViewedAt(
      itemId,
      latest,
      () => commentsViewedAfterComment(itemId, latest, ncomments)
    )
  }, [itemId, updateViewedAt])

  // update meCommentsViewedAt on item view
  const markItemViewed = useCallback((latest) => {
    if (!item || (item?.meCommentsViewedAt && !newComments(item))) return
    const newLatest = new Date(latest || item?.lastCommentAt)

    updateViewedAt(
      itemId,
      newLatest,
      () => commentsViewed(item)
    )
  }, [item, itemId, updateViewedAt])

  return { markCommentViewedAt, markItemViewed }
}
