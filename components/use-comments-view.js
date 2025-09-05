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
  }, [me?.id, updateCommentsViewAt, updateCache])

  // update meCommentsViewedAt on comment injection
  const markCommentViewedAt = useCallback((latest, { rootId, ncomments } = {}) => {
    const id = rootId || root.id

    updateViewTimestamp(
      id,
      latest,
      () => commentsViewedAfterComment(id, latest, ncomments)
    )
  }, [root?.id, updateViewTimestamp, updateCache])

  // update meCommentsViewedAt on item view
  const markItemViewed = useCallback(() => {
    if (item.meCommentsViewedAt && !newComments(item)) return

    const { lastCommentAt } = item
    const latest = new Date(lastCommentAt)

    updateViewTimestamp(
      item.id,
      latest,
      () => commentsViewed(item)
    )
  }, [updateViewTimestamp, updateCache])

  return { markCommentViewedAt, markItemViewed }
}
