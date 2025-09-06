import { useMutation } from '@apollo/client'
import { useCallback } from 'react'
import { UPDATE_ITEM_USER_VIEW } from '@/fragments/items'
import { commentsViewedAfterComment, commentsViewed, newComments } from '@/lib/new-comments'
import { useMe } from './me'
import { useRoot } from './root'

export default function useCommentsView ({ itemId, updateCache = true } = {}) {
  const { me } = useMe()
  const root = useRoot()
  const id = itemId || root?.id

  const [updateCommentsViewAt] = useMutation(UPDATE_ITEM_USER_VIEW, {
    update (cache, { data: { updateCommentsViewAt } }) {
      if (!updateCache || !id) return

      cache.modify({
        id: `Item:${id}`,
        fields: { meCommentsViewedAt: () => updateCommentsViewAt }
      })
    }
  })

  const updateViewedAt = useCallback((latest, anonFallbackFn) => {
    if (me?.id) {
      updateCommentsViewAt({ variables: { id, meCommentsViewedAt: latest } })
    } else {
      anonFallbackFn()
    }
  }, [me?.id, id, updateCommentsViewAt])

  // update meCommentsViewedAt on comment injection
  const markCommentViewedAt = useCallback((latest, { ncomments } = {}) => {
    if (!latest) return

    updateViewedAt(latest, () => commentsViewedAfterComment(id, latest, ncomments))
  }, [id, updateViewedAt])

  // update meCommentsViewedAt on item view
  const markItemViewed = useCallback((item, latest) => {
    if (!item || (item?.meCommentsViewedAt && !newComments(item))) return
    const lastAt = latest || item?.lastCommentAt || item?.createdAt
    const newLatest = new Date(lastAt)

    updateViewedAt(newLatest, () => commentsViewed(item))
  }, [updateViewedAt])

  return { markCommentViewedAt, markItemViewed }
}
