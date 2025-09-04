import { COMMENTS } from '../fragments/comments'
import { gql } from '@apollo/client'

export function injectComment (cache, rootId, newComment, { live = false } = {}) {
  const topLevel = Number(rootId) === Number(newComment.parentId)

  const hasComments = !topLevel
    ? cache.readFragment({
      id: `Item:${newComment.parentId}`,
      fragment: gql`
        fragment HasComments on Item {
          comments
        }
      `
    })
    : true

  const updated = hasComments && cache.modify({
    id: `Item:${newComment.parentId}`,
    fields: {
      comments: (existingComments = {}, { readField }) => {
        if (existingComments?.comments?.some(c => readField('id', c) === newComment.id)) return existingComments

        // we need to make sure we're writing a fragment that matches the comments query (comments field)
        const newCommentRef = cache.writeFragment({
          data: { comments: { comments: [] }, ...newComment, live },
          fragment: COMMENTS,
          fragmentName: 'CommentsRecursive'
        })

        return {
          cursor: existingComments.cursor,
          comments: [newCommentRef, ...(existingComments?.comments || [])]
        }
      }
    },
    optimistic: true
  })

  // run side effects if injection succeeded or if injecting live comment into SSR item without comments field
  if (updated || (live && !hasComments)) {
    // update all ancestors comment count, but not the item itself
    const ancestors = newComment.path.split('.').slice(0, -1)
    updateAncestorsCommentCount(cache, ancestors, 1, newComment.parentId)
    return true
  }

  return false
}

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
