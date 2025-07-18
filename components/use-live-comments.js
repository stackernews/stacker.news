import { useQuery, useApolloClient } from '@apollo/client'
import { SSR } from '../lib/constants'
import { GET_NEW_COMMENTS } from '../fragments/comments'
import { useEffect, useState } from 'react'
import { itemUpdateQuery, commentUpdateFragment, getLatestCommentCreatedAt } from '../lib/comments'

const POLL_INTERVAL = 1000 * 10 // 10 seconds

// merge new comment into item's newComments
// and prevent duplicates by checking if the comment is already in item's newComments
function mergeNewComment (item, newComment) {
  const existingNewComments = item.newComments || []

  // is the incoming new comment already in item's new comments?
  if (existingNewComments.includes(newComment.id)) {
    return item
  }

  return { ...item, newComments: [...existingNewComments, newComment.id] }
}

function cacheNewComments (client, rootId, newComments, sort) {
  for (const newComment of newComments) {
    const { parentId } = newComment
    const topLevel = Number(parentId) === Number(rootId)

    // if the comment is a top level comment, update the item
    if (topLevel) {
      // merge the new comment into the item's newComments field, checking for duplicates
      itemUpdateQuery(client, rootId, sort, (data) => mergeNewComment(data, newComment))
    } else {
      // if the comment is a reply, update the parent comment
      // merge the new comment into the parent comment's newComments field, checking for duplicates
      commentUpdateFragment(client, parentId, (data) => mergeNewComment(data, newComment))
    }
  }
}

// useLiveComments fetches new comments under an item (rootId), that arrives after the latest comment createdAt
// and inserts them into the newComment client field of their parent comment/post.
export default function useLiveComments (rootId, after, sort) {
  const latestKey = `liveCommentsLatest:${rootId}`
  const client = useApolloClient()
  const [latest, setLatest] = useState(() => {
    // if we're on the client, get the latest timestamp from session storage, otherwise use the passed after timestamp
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem(latestKey) || after
    }
    return after
  })

  const { data } = useQuery(GET_NEW_COMMENTS, SSR
    ? {}
    : {
        pollInterval: POLL_INTERVAL,
        // only get comments newer than the passed latest timestamp
        variables: { rootId, after: latest },
        nextFetchPolicy: 'cache-and-network'
      })

  useEffect(() => {
    console.log('data', data)
    if (!data?.newComments?.comments?.length) return

    // merge and cache new comments in their parent comment/post
    cacheNewComments(client, rootId, data.newComments.comments, sort)

    // update latest timestamp to the latest comment created at
    // save it to session storage, to persist between client-side navigations
    const newLatest = getLatestCommentCreatedAt(data.newComments.comments, latest)
    setLatest(newLatest)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(latestKey, newLatest)
    }
  }, [data, client, rootId, sort, latest])
}
