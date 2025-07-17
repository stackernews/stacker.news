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

// reads a nested comments fragment from the cache
// this is used to read a comment and its children comments
// it has a fallback for comments nearing the depth limit, that lack the CommentsRecursive fragment
export function readNestedCommentsFragment (client, id) {
  return client.cache.readFragment({
    id: `Item:${id}`,
    fragment: COMMENT_WITH_NEW_RECURSIVE,
    fragmentName: 'CommentWithNewRecursive'
  }) || client.cache.readFragment({
    id: `Item:${id}`,
    fragment: COMMENT_WITH_NEW_LIMITED,
    fragmentName: 'CommentWithNewLimited'
  })
}

// finds the most recent createdAt timestamp from an array of comments
export function getLatestCommentCreatedAt (comments, latest) {
  return comments.reduce(
    (max, { createdAt }) => (createdAt > max ? createdAt : max),
    latest
  )
}
