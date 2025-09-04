import { useMutation } from '@apollo/client'
import { useCallback } from 'react'
import { UPDATE_ITEM_USER_VIEW } from '@/fragments/items'
import { commentsViewedAfterComment } from '@/lib/new-comments'
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

  // update the meCommentsViewedAt field for the root item
  const markViewedAt = useCallback((latest, { rootId, ncomments } = {}) => {
    const id = rootId || root.id
    if (me?.id) {
      updateCommentsViewAt({ variables: { id, meCommentsViewedAt: latest } })
    } else {
      commentsViewedAfterComment(id, latest, ncomments)
    }
  }, [me?.id, root?.id, updateCommentsViewAt, updateCache])

  return markViewedAt
}
