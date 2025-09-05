import { useMutation } from '@apollo/client'
import { useCallback } from 'react'
import { UPDATE_ITEM_USER_VIEW } from '@/fragments/items'
import { commentsViewedAfterComment, commentsViewed, newComments } from '@/lib/new-comments'
import { useMe } from './me'
import { useRoot } from './root'

export default function useCommentsView ({ item, updateCache = true } = {}) {
  const { me } = useMe()
  const root = useRoot()

  const [updateCommentsViewAt] = useMutation(UPDATE_ITEM_USER_VIEW, {
    update (cache, { data: { updateCommentsViewAt } }) {
      if (!updateCache) return

      cache.modify({
        id: `Item:${item?.id || root?.id}`,
        fields: { meCommentsViewedAt: () => updateCommentsViewAt }
      })
    }
  })

  const updateViewTimestamp = useCallback((id, timestamp, anonFallbackFn) => {
    if (me?.id) {
      updateCommentsViewAt({ variables: { id, meCommentsViewedAt: timestamp } })
    } else {
      anonFallbackFn()
    }
  }, [me?.id, updateCommentsViewAt])

  // update meCommentsViewedAt on comment injection
  const markCommentViewedAt = useCallback((latest, { ncomments } = {}) => {
    const id = item?.id || root?.id

    updateViewTimestamp(
      id,
      latest,
      () => commentsViewedAfterComment(id, latest, ncomments)
    )
  }, [item?.id, root?.id, updateViewTimestamp])

  // update meCommentsViewedAt on item view
  const markItemViewed = useCallback(() => {
    if (item?.meCommentsViewedAt && !newComments(item)) return
    const latest = new Date(item?.lastCommentAt)

    updateViewTimestamp(
      item?.id,
      latest,
      () => commentsViewed(item)
    )
  }, [item?.id, root?.id, updateViewTimestamp])

  return { markCommentViewedAt, markItemViewed }
}
