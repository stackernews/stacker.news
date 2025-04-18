import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import { GET_NEW_COMMENTS, COMMENT_WITH_NEW } from '../fragments/comments'
import { ITEM_FULL } from '../fragments/items'
import { useState } from 'react'

export function useLiveComments (rootId, after) {
  const client = useApolloClient()
  const [lastChecked, setLastChecked] = useState(after)
  const { data, error } = useQuery(GET_NEW_COMMENTS, SSR
    ? {}
    : {
        pollInterval: 10000,
        variables: { rootId, after: lastChecked }
      })

  console.log('error', error)

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
  console.log('newComments', newComments)
  for (const comment of newComments) {
    console.log('comment', comment)
    const parentId = comment.parentId
    if (Number(parentId) === Number(rootId)) {
      console.log('parentId', parentId)
      client.cache.updateQuery({
        query: ITEM_FULL,
        variables: { id: rootId }
      }, (data) => {
        console.log('data', data)
        if (!data) return data
        console.log('dataTopLevel', data)

        const { item } = data

        return { item: dedupeComment(item, comment) }
      })
    } else {
      console.log('not top level', parentId)
      client.cache.updateFragment({
        id: `Item:${parentId}`,
        fragment: COMMENT_WITH_NEW,
        fragmentName: 'CommentWithNew'
      }, (data) => {
        if (!data) return data

        console.log('data', data)

        return dedupeComment(data, comment)
      })
      console.log('fragment', client.cache.readFragment({
        id: `Item:${parentId}`,
        fragment: COMMENT_WITH_NEW,
        fragmentName: 'CommentWithNew'
      }))
    }
  }
}

function dedupeComment (item, newComment) {
  const existingNewComments = item.newComments || []
  const alreadyInNewComments = existingNewComments.some(c => c.id === newComment.id)
  const updatedNewComments = alreadyInNewComments ? existingNewComments : [...existingNewComments, newComment]
  console.log(item)
  const filteredComments = updatedNewComments.filter((comment) => !item.comments?.comments?.some(c => c.id === comment.id))
  const final = { ...item, newComments: filteredComments }
  console.log('final', final)
  return final
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
