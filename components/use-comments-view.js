import { useMutation } from '@apollo/client'
import { useCallback } from 'react'
import { UPDATE_ITEM_USER_VIEW } from '@/fragments/items'
import { commentsViewedAfterComment, commentsViewed, newComments } from '@/lib/new-comments'
import { useMe } from './me'

export default function useCommentsView (itemId, { updateCache = true } = {}) {
  const { me } = useMe()

  const [updateCommentsViewAt] = useMutation(UPDATE_ITEM_USER_VIEW, {
    update (cache, { data: { updateCommentsViewAt } }) {
      if (!updateCache || !itemId) return

      cache.modify({
        id: `Item:${itemId}`,
        fields: { meCommentsViewedAt: () => updateCommentsViewAt }
      })
    }
  })

  const updateViewedAt = useCallback((latest, anonFallbackFn) => {
    if (me?.id) {
      updateCommentsViewAt({ variables: { id: Number(itemId), meCommentsViewedAt: latest } })
    } else {
      anonFallbackFn()
    }
  }, [me?.id, itemId, updateCommentsViewAt])

  // update meCommentsViewedAt on comment injection
  const markCommentViewedAt = useCallback((latest, { ncomments } = {}) => {
    if (!latest) return

    updateViewedAt(latest, () => commentsViewedAfterComment(itemId, latest, ncomments))
  }, [itemId, updateViewedAt])

  // update meCommentsViewedAt on item view
  const markItemViewed = useCallback((item, latest) => {
    if (!item || item.parentId || (item?.meCommentsViewedAt && !newComments(item))) return
    const lastAt = latest || item?.lastCommentAt || item?.createdAt
    const newLatest = new Date(lastAt)

    updateViewedAt(newLatest, () => commentsViewed(item))
  }, [updateViewedAt])

  return { markCommentViewedAt, markItemViewed }
}
