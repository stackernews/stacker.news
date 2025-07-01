import { useCallback } from 'react'
import { useApolloClient } from '@apollo/client'
import { COMMENT_WITH_NEW } from '../fragments/comments'
import styles from './comment.module.css'
import { itemUpdateQuery, commentUpdateFragment } from './use-live-comments'

function prepareComments (client, newComments) {
  return (data) => {
    // TODO: it might be sane to pass the cache ref to the ShowNewComments component
    // TODO: and use it to read the latest newComments from the cache
    // newComments can have themselves new comments between the time the button is clicked and the query is executed
    // so we need to read the latest newComments from the cache
    const freshNewComments = newComments.map(c => {
      const fragment = client.cache.readFragment({
        id: `Item:${c.id}`,
        fragment: COMMENT_WITH_NEW,
        fragmentName: 'CommentWithNew'
      })
      // if the comment is not in the cache, return the original comment
      return fragment || c
    })

    // count the total number of comments including nested comments
    let ncomments = data.ncomments + freshNewComments.length
    for (const comment of freshNewComments) {
      ncomments += (comment.ncomments || 0)
    }

    return {
      ...data,
      comments: { ...data.comments, comments: [...freshNewComments, ...data.comments.comments] },
      ncomments,
      newComments: []
    }
  }
}

// ShowNewComments is a component that dedupes, refreshes and injects newComments into the comments field
export function ShowNewComments ({ newComments = [], itemId, topLevel = false, sort }) {
  const client = useApolloClient()

  const showNewComments = useCallback(() => {
    const payload = prepareComments(client, newComments)

    if (topLevel) {
      itemUpdateQuery(client, itemId, sort, payload)
    } else {
      commentUpdateFragment(client, itemId, payload)
    }
  }, [client, itemId, newComments, topLevel, sort])

  return (
    <div
      onClick={showNewComments}
      className={`${topLevel && `d-block fw-bold ${styles.comment} pb-2`} d-flex align-items-center gap-2 px-3 pointer`}
    >
      {newComments.length > 1 ? `${newComments.length} new comments` : 'show new comment'}
      <div className={styles.newCommentDot} />
    </div>
  )
}
