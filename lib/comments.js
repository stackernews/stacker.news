import { COMMENTS } from '../fragments/comments'
import { gql } from '@apollo/client'

export function injectComment (cache, rootId, newComment, { live = false, batchIds } = {}) {
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
    updateAncestorsCommentCount(cache, ancestors, newComment.parentId, { ncomments: 1, nDirectComments: 1, batchIds })

    return true
  }

  return false
}

// updates the ncomments field of all ancestors of an item/comment in the cache
// if live comments are injecting both the parent and the child, their counts are already updated by the time the child is injected
// so we need to ignore already updated parents if present in batchIds
function updateAncestorsCommentCount (cache, ancestors, parentId, { ncomments = 1, nDirectComments = 1, batchIds } = {}) {
  // update nDirectComments of immediate parent
  if (!batchIds?.has(String(parentId))) {
    cache.modify({
      id: `Item:${parentId}`,
      fields: {
        nDirectComments (existingNDirectComments = 0) {
          return existingNDirectComments + nDirectComments
        }
      },
      optimistic: true
    })
  }

  // update ncomments of all ancestors
  ancestors.forEach(id => {
    if (batchIds?.has(id)) return
    cache.modify({
      id: `Item:${id}`,
      fields: {
        ncomments (existingNComments = 0) {
          return existingNComments + ncomments
        }
      },
      optimistic: true
    })
  })
}
