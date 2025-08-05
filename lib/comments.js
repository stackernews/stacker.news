import { COMMENT_WITH_NEW_RECURSIVE, COMMENT_WITH_NEW_LIMITED, COMMENT_WITH_NEW_MINIMAL } from '../fragments/comments'
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
// reads an item query from the cache
// this is used to read an item and its comments
export function readItemQuery (client, id, sort) {
  return client.cache.readQuery({
    query: ITEM_FULL,
    variables: sort ? { id, sort } : { id }
  })
}

// reads a nested comments fragment from the cache
// this is used to read a comment and its children comments
// it has a fallback for comments nearing the depth limit, that lack the CommentsRecursive fragment
export function readCommentsFragment (client, id) {
  return client.cache.readFragment({
    id: `Item:${id}`,
    fragment: COMMENT_WITH_NEW_RECURSIVE,
    fragmentName: 'CommentWithNewRecursive'
  }) || client.cache.readFragment({
    id: `Item:${id}`,
    fragment: COMMENT_WITH_NEW_LIMITED,
    fragmentName: 'CommentWithNewLimited'
  }) || client.cache.readFragment({
    id: `Item:${id}`,
    fragment: COMMENT_WITH_NEW_MINIMAL,
    fragmentName: 'CommentWithNewMinimal'
  })
}

// updates the item query in the cache
// this is used by live comments to update a top level item's newComments field
export function writeItemQuery (client, id, sort, data) {
  client.cache.writeQuery({
    query: ITEM_FULL,
    variables: sort ? { id, sort } : { id },
    data: { item: data }
  })
}

// updates a comment fragment in the cache, with fallbacks for comments lacking CommentsRecursive or Comments altogether
export function writeCommentFragment (client, id, data) {
  let result = client.cache.writeFragment({
    id: `Item:${id}`,
    fragment: COMMENT_WITH_NEW_RECURSIVE,
    fragmentName: 'CommentWithNewRecursive',
    data
  })

  // sometimes comments can start to reach their depth limit, and lack adherence to the CommentsRecursive fragment
  // for this reason, we update the fragment with a limited version that only includes the CommentFields fragment
  if (!result) {
    result = client.cache.writeFragment({
      id: `Item:${id}`,
      fragment: COMMENT_WITH_NEW_LIMITED,
      fragmentName: 'CommentWithNewLimited',
      data
    })
  }

  // at the deepest level, the comment can't have any children, here we update only the newComments field.
  if (!result) {
    result = client.cache.writeFragment({
      id: `Item:${id}`,
      fragment: COMMENT_WITH_NEW_MINIMAL,
      fragmentName: 'CommentWithNewMinimal',
      data
    })
  }
}

// finds the most recent createdAt timestamp from an array of comments
export function getLatestCommentCreatedAt (comments, latest) {
  return comments.reduce(
    (max, { createdAt }) => (createdAt > max ? createdAt : max),
    latest
  )
}
