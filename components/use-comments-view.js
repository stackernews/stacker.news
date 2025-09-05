import { useMutation } from '@apollo/client'
import { useCallback } from 'react'
import { UPDATE_ITEM_USER_VIEW } from '@/fragments/items'
import { commentsViewedAfterComment, commentsViewed, newComments } from '@/lib/new-comments'
import { useMe } from './me'
import { useRoot } from './root'

export default function useCommentsView ({ updateCache = true } = {}) {
  const { me } = useMe()
  const root = useRoot()

  const [updateCommentsViewAt] = useMutation(UPDATE_ITEM_USER_VIEW, updateCache && {
    update (cache, { data: { updateCommentsViewAt } }) {
      cache.modify({
        id: `Item:${root.id}`,
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
  const markCommentViewedAt = useCallback((latest, { rootId, ncomments } = {}) => {
    const id = rootId || root.id
    updateViewTimestamp(
      id,
      latest,
      () => commentsViewedAfterComment(id, latest, ncomments)
    )
  }, [me?.id, root?.id, updateViewTimestamp])

  // update meCommentsViewedAt on item view
  const markItemViewed = useCallback(item => {
    if (!newComments(item)) return
    const { lastCommentAt, createdAt } = item
    const latest = new Date(lastCommentAt || createdAt)

    updateViewTimestamp(
      item.id,
      latest,
      () => commentsViewed(item)
    )
  }, [me?.id, updateViewTimestamp])

  return { markCommentViewedAt, markItemViewed }
}
