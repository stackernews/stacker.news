import { COMMENT_WITH_NEW_RECURSIVE, COMMENT_WITH_NEW_LIMITED, COMMENT_WITH_NEW_MINIMAL } from '../fragments/comments'
import { ITEM_FULL } from '../fragments/items'

// updates the ncomments field of all ancestors of an item/comment in the cache
export function updateAncestorsCommentCount (cache, ancestors, increment, parentId) {
  // update all ancestors
  ancestors.forEach(id => {
    cache.modify({
      id: `Item:${id}`,
      fields: {
        ncomments (existingNComments = 0) {
          return existingNComments + increment
        },
        nDirectComments (existingNDirectComments = 0) {
          // only increment nDirectComments for the immediate parent
          if (parentId && Number(id) === Number(parentId)) {
            return existingNDirectComments + 1
          }
          return existingNDirectComments
        }
      },
      optimistic: true
    })
  })
}

// updates the item query in the cache
// this is used by live comments to update a top level item's comments field
export function updateItemQuery (cache, id, sort, fn) {
  cache.updateQuery({
    query: ITEM_FULL,
    // updateQuery needs the correct variables to update the correct item
    // the Item query might have the router.query.sort in the variables, so we need to pass it in if it exists
    variables: sort ? { id, sort } : { id }
  }, (data) => {
    if (!data) return data
    return { item: fn(data.item) }
  })
}

// updates a comment fragment in the cache, with fallbacks for comments lacking CommentsRecursive or Comments altogether
export function updateCommentFragment (cache, id, fn) {
  let result = cache.updateFragment({
    id: `Item:${id}`,
    fragment: COMMENT_WITH_NEW_RECURSIVE,
    fragmentName: 'CommentWithNewRecursive'
  }, (data) => {
    if (!data) return data
    return fn(data)
  })

  // sometimes comments can start to reach their depth limit, and lack adherence to the CommentsRecursive fragment
  // for this reason, we update the fragment with a limited version that only includes the CommentFields fragment
  if (!result) {
    result = cache.updateFragment({
      id: `Item:${id}`,
      fragment: COMMENT_WITH_NEW_LIMITED,
      fragmentName: 'CommentWithNewLimited'
    }, (data) => {
      if (!data) return data
      return fn(data)
    })
  }

  // at the deepest level, the comment can't have any children, here we update only the newComments field.
  if (!result) {
    result = cache.updateFragment({
      id: `Item:${id}`,
      fragment: COMMENT_WITH_NEW_MINIMAL,
      fragmentName: 'CommentWithNewMinimal'
    }, (data) => {
      if (!data) return data
      return fn(data)
    })
  }

  return result
}

export function calculateDepth (path, rootId, parentId) {
  // calculate depth by counting path segments from root to parent
  const pathSegments = path.split('.')
  const rootIndex = pathSegments.indexOf(rootId.toString())
  const parentIndex = pathSegments.indexOf(parentId.toString())

  // depth is the distance from root to parent in the path
  const depth = parentIndex - rootIndex

  return depth
}

// finds the most recent createdAt timestamp from an array of comments
export function getLatestCommentCreatedAt (comments, latest) {
  return comments.reduce(
    (max, { createdAt }) => (createdAt > max ? createdAt : max),
    latest
  )
}
