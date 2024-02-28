import styles from './show-new-comments-button.module.css'
import { useApolloClient } from '@apollo/client'
import { ITEM_WITH_COMMENTS } from '../fragments/comments'
import { ITEM_FULL } from '../fragments/items'

export function ShowNewCommentsButton ({ newComments = [], itemId, updateQuery = false }) {
  const client = useApolloClient()

  const showNewComments = () => {
    if (updateQuery) {
      client.cache.updateQuery({
        query: ITEM_FULL,
        variables: { id: itemId }
      }, (data) => {
        if (!data) return data
        const { item } = data

        const existingComments = item?.comments || []
        // Prevent duplicate comments from being added
        const filtered = newComments.filter((newComment) => !existingComments.some(existing => existing.id === newComment.id))
        // Append new comments so they appear within view
        const updatedComments = existingComments.concat(filtered)

        return {
          item: {
            ...item,
            comments: updatedComments,
            newComments: []
          },
        }
      })
    } else {
      client.cache.updateFragment({
        id: `Item:${itemId}`,
        fragmentName: 'ItemWithComments',
        fragment: ITEM_WITH_COMMENTS
      }, (data) => {
        const existingComments = data?.comments || []
        // Prevent duplicate comments from being added
        const filtered = newComments.filter((newComment) => !existingComments.some(existing => existing.id === newComment.id))
        // Prepend new comments so they appear within view
        const updatedComments = filtered.concat(existingComments)

        return {
          ...data,
          comments: updatedComments,
          newComments: []
        }
      })
    }
  }

  return (
    <span
      className={styles.showNewCommentsButton}
      onClick={showNewComments}
    >
      show new {newComments.length === 1 ? 'comment' : 'comments'}
    </span>
  )
}
