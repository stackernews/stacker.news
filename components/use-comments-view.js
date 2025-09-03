// components/use-comments-view.js
import { useMutation } from '@apollo/client'
import { useMe } from './me'
import { useRoot } from './root'
import { UPDATE_ITEM_USER_VIEW } from '@/fragments/items'
import { commentsViewedAfterComment } from '@/lib/new-comments'
import { useCallback } from 'react'

export default function useCommentsView () {
  const { me } = useMe()
  const root = useRoot()

  const [updateCommentsViewAt] = useMutation(UPDATE_ITEM_USER_VIEW, {
    update (cache, { data: { updateCommentsViewAt } }) {
      cache.modify({
        id: `Item:${root.id}`,
        fields: { meCommentsViewedAt: () => updateCommentsViewAt }
      })
    }
  })

  // TODO: comment?
  const markViewedAt = useCallback((createdAt, { rootId, ncomments } = {}) => {
    const id = rootId || root.id
    if (me?.id) {
      updateCommentsViewAt({ variables: { id, meCommentsViewedAt: createdAt } })
    } else {
      commentsViewedAfterComment(id, createdAt, ncomments)
    }
  }, [me?.id, root?.id, updateCommentsViewAt])

  return markViewedAt
}
