import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import { GET_NEW_COMMENTS, COMMENT_WITH_NEW } from '../fragments/comments'
import { ITEM_FULL } from '../fragments/items'
import { useState } from 'react'

export function useLiveComments (rootId, after) {
  const client = useApolloClient()
  const [lastChecked, setLastChecked] = useState(after)
  const { data } = useQuery(GET_NEW_COMMENTS, SSR
    ? {}
    : {
        pollInterval: 10000,
        variables: { rootId, after: lastChecked }
      })

  if (data && data.newComments) {
    saveNewComments(client, rootId, data.newComments.comments)
    const latestCommentCreatedAt = getLastCommentCreatedAt(data.newComments.comments)
    if (latestCommentCreatedAt) {
      setLastChecked(latestCommentCreatedAt)
    }
  }

  return null
}

export function saveNewComments (client, rootId, newComments) {
  for (const comment of newComments) {
    const { parentId } = comment
    const topLevel = Number(parentId) === Number(rootId)

    // if the comment is a top level comment, update the item
    if (topLevel) {
      client.cache.updateQuery({
        query: ITEM_FULL,
        variables: { id: rootId }
      }, (data) => {
        if (!data) return data
        // we return the entire item, not just the newComments
        return { item: dedupeComment(data?.item, comment) }
      })
    } else {
      // if the comment is a reply, update the parent comment
      client.cache.updateFragment({
        id: `Item:${parentId}`,
        fragment: COMMENT_WITH_NEW,
        fragmentName: 'CommentWithNew'
      }, (data) => {
        if (!data) return data
        // here we return the parent comment with the new comment added
        return dedupeComment(data, comment)
      })
    }
  }
}

function dedupeComment (item, newComment) {
  // get the existing comment ids for faster lookup
  const existingCommentIds = new Set(
    (item.comments?.comments || []).map(c => c.id)
  )
  const existingNewComments = item.newComments || []

  // is the incoming new comment already in item's new comments?
  if (existingNewComments.some(c => c.id === newComment.id)) {
    return item
  }

  // if the incoming new comment is not in item's new comments, add it
  // sanity check: and if somehow the incoming new comment is in
  // item's new comments, remove it
  const updatedNewComments = !existingCommentIds.has(newComment.id)
    ? [...existingNewComments, newComment]
    : existingNewComments.filter(c => c.id !== newComment.id)

  return { ...item, newComments: updatedNewComments }
}

function getLastCommentCreatedAt (comments) {
  if (comments.length === 0) return null
  let latest = comments[0].createdAt
  for (const comment of comments) {
    if (comment.createdAt > latest) {
      latest = comment.createdAt
    }
  }
  return latest
}
