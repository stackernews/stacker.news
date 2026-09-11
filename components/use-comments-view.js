import { useMutation } from '@apollo/client/react'
import { useCallback } from 'react'
import { UPDATE_ITEM_USER_VIEW } from '@/fragments/items'
import { commentsViewedAfterComment, commentsViewed, newComments, nextCommentsViewedAt } from '@/lib/new-comments'
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

  // update meCommentsViewedAt on item view.
  // Comment permalinks (/items/<commentId>, the notifications deep-link) used
  // to no-op because of parentId, so the thread's blue dot stayed on the feed
  // after you had already opened (and even zapped) that comment. #3150
  const markItemViewed = useCallback((item, latest) => {
    if (!item) return

    if (item.parentId) {
      const lastAt = latest || item.createdAt
      if (!lastAt) return
      const existing = item.root?.meCommentsViewedAt
      const next = nextCommentsViewedAt(existing, lastAt)
      if (existing && new Date(existing).getTime() === next) return
      const newLatest = new Date(next)
      const rootLast = item.root?.lastCommentAt
      const sawLatest = !rootLast || new Date(lastAt).getTime() >= new Date(rootLast).getTime()
      updateViewedAt(newLatest, () => {
        if (sawLatest && item.root && !item.root.parentId) commentsViewed(item.root)
        else commentsViewedAfterComment(itemId, lastAt, 0)
      })
      return
    }

    if (item.meCommentsViewedAt && !newComments(item)) return
    const lastAt = latest || item.lastCommentAt || item.createdAt
    const newLatest = new Date(lastAt)

    updateViewedAt(newLatest, () => commentsViewed(item))
  }, [updateViewedAt, itemId])

  return { markCommentViewedAt, markItemViewed }
}
