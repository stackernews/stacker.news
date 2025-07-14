import { COMMENT_DEPTH_LIMIT } from './constants'
import { commentsViewedAfterComment } from './new-comments'
import { COMMENT_WITH_NEW_RECURSIVE, COMMENT_WITH_NEW_LIMITED } from '../fragments/comments'
import { ITEM_FULL } from '../fragments/items'

// updates the ncomments field of all ancestors of an item/comment in the cache
export function updateAncestorsCommentCount (cache, ancestors, increment) {
  // update all ancestors
  ancestors.forEach(id => {
    cache.modify({
      id: `Item:${id}`,
      fields: {
        ncomments (existingNComments = 0) {
          return existingNComments + increment
        }
      },
      optimistic: true
    })
  })
}

// live comments - cache manipulations
// updates the item query in the cache
// this is used by live comments to update a top level item's newComments field
export function itemUpdateQuery (client, id, sort, fn) {
  client.cache.updateQuery({
    query: ITEM_FULL,
    // updateQuery needs the correct variables to update the correct item
    // the Item query might have the router.query.sort in the variables, so we need to pass it in if it exists
    variables: sort ? { id, sort } : { id }
  }, (data) => {
    if (!data) return data
    return { item: fn(data.item) }
  })
}

// updates a comment fragment in the cache, with a fallback for comments lacking CommentsRecursive
export function commentUpdateFragment (client, id, fn) {
  let result = client.cache.updateFragment({
    id: `Item:${id}`,
    fragment: COMMENT_WITH_NEW_RECURSIVE,
    fragmentName: 'CommentWithNewRecursive'
  }, (data) => {
    if (!data) return data
    return fn(data)
  })

  // sometimes comments can reach their depth limit, and lack adherence to the CommentsRecursive fragment
  // for this reason, we update the fragment with a limited version that only includes the CommentFields fragment
  if (!result) {
    result = client.cache.updateFragment({
      id: `Item:${id}`,
      fragment: COMMENT_WITH_NEW_LIMITED,
      fragmentName: 'CommentWithNewLimited'
    }, (data) => {
      if (!data) return data
      return fn(data)
    })
  }

  return result
}

// filters out new comments, by id, that already exist in the item's comments
// preventing duplicate comments from being injected
export function dedupeNewComments (newComments, comments) {
  console.log('dedupeNewComments', newComments, comments)
  const existingIds = new Set(comments.map(c => c.id))
  return newComments.filter(id => !existingIds.has(id))
}

// recursively collects all new comments from an item and its children
// by respecting the depth limit, we avoid collecting new comments to inject in places
// that are too deep in the tree
export function collectAllNewComments (item, currentDepth = 1) {
  const allNewComments = [...(item.newComments || [])]
  if (item.comments?.comments && currentDepth < (COMMENT_DEPTH_LIMIT - 1)) {
    for (const comment of item.comments.comments) {
      allNewComments.push(...collectAllNewComments(comment, currentDepth + 1))
    }
  }
  return allNewComments
}

// prepares and creates a new comments fragment for injection into the cache
// returns a function that can be used to update an item's comments field
export function prepareComments (client, newComments) {
  return (data) => {
    // newComments is an array of comment ids that allows us
    // to read the latest newComments from the cache, guaranteeing that we're not reading stale data
    const freshNewComments = newComments.map(id => {
      const fragment = client.cache.readFragment({
        id: `Item:${id}`,
        fragment: COMMENT_WITH_NEW_RECURSIVE,
        fragmentName: 'CommentWithNewRecursive'
      })

      if (!fragment) {
        return null
      }

      return fragment
    }).filter(Boolean)

    // count the total number of new comments including its nested new comments
    let totalNComments = freshNewComments.length
    for (const comment of freshNewComments) {
      totalNComments += (comment.ncomments || 0)
    }

    // update all ancestors, but not the item itself
    const ancestors = data.path.split('.').slice(0, -1)
    updateAncestorsCommentCount(client.cache, ancestors, totalNComments)

    // update commentsViewedAt with the most recent fresh new comment
    // quirk: this is not the most recent comment, it's the most recent comment in the freshNewComments array
    //        as such, the next visit will not outline other new comments that have not been injected yet
    const latestCommentCreatedAt = getLatestCommentCreatedAt(freshNewComments, data.createdAt)
    const rootId = data.path.split('.')[0]
    commentsViewedAfterComment(rootId, latestCommentCreatedAt)

    // return the updated item with the new comments injected
    return {
      ...data,
      comments: { ...data.comments, comments: [...freshNewComments, ...data.comments.comments] },
      ncomments: data.ncomments + totalNComments,
      newComments: []
    }
  }
}

// recursively processes and displays all new comments for a thread
// handles comment injection at each level, respecting depth limits
export function showAllNewCommentsRecursively (client, item, currentDepth = 1) {
  // handle new comments at this item level
  if (item.newComments && item.newComments.length > 0) {
    const dedupedNewComments = dedupeNewComments(item.newComments, item.comments?.comments)

    if (dedupedNewComments.length > 0) {
      const payload = prepareComments(client, dedupedNewComments)
      commentUpdateFragment(client, item.id, payload)
    }
  }

  // recursively handle new comments in child comments
  if (item.comments?.comments && currentDepth < (COMMENT_DEPTH_LIMIT - 1)) {
    for (const childComment of item.comments.comments) {
      showAllNewCommentsRecursively(client, childComment, currentDepth + 1)
    }
  }
}

// finds the most recent createdAt timestamp from an array of comments
export function getLatestCommentCreatedAt (comments, latest) {
  return comments.reduce(
    (max, { createdAt }) => (createdAt > max ? createdAt : max),
    latest
  )
}
