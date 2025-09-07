import { COMMENTS, HAS_COMMENTS } from '../fragments/comments'

// adds a comment to the cache, under its parent item
function cacheComment (cache, newComment, { live = false }) {
  return cache.modify({
    id: `Item:${newComment.parentId}`,
    fields: {
      comments: (existingComments = {}, { readField }) => {
        // if the comment already exists, return
        if (existingComments?.comments?.some(c => readField('id', c) === newComment.id)) return existingComments

        // we need to make sure we're writing a fragment that matches the comments query (comments and count fields)
        const newCommentRef = cache.writeFragment({
          data: {
            comments: {
              comments: []
            },
            ncomments: 0,
            nDirectComments: 0,
            ...newComment,
            live
          },
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
}

// handles cache injection and side-effects for both live and non-live comments
export function injectComment (cache, newComment, { live = false, rootId } = {}) {
  // if live and a reply (not top level), check if the parent has comments
  const hasComments = live && !(Number(rootId) === Number(newComment.parentId))
    ? !!(cache.readFragment({
        id: `Item:${newComment.parentId}`,
        fragment: HAS_COMMENTS
      }))
    // if not live, we can assume the parent has the comments field since user replied to it
    : true

  const updated = hasComments && cacheComment(cache, newComment, { live })

  // run side effects if injection succeeded or if injecting live comment into SSR item without comments field
  if (updated || (live && !hasComments)) {
    // update all ancestors comment count, excluding the comment itself
    const ancestors = newComment.path.split('.').slice(0, -1)
    updateAncestorsCommentCount(cache, ancestors)

    return true
  }

  return false
}

// updates the ncomments and nDirectComments fields of all ancestors of an item/comment in the cache
function updateAncestorsCommentCount (cache, ancestors, { ncomments = 1, nDirectComments = 1 } = {}) {
  // update nDirectComments of immediate parent
  cache.modify({
    id: `Item:${ancestors[ancestors.length - 1]}`,
    fields: {
      nDirectComments (existingNDirectComments = 0) {
        return existingNDirectComments + nDirectComments
      }
    },
    optimistic: true
  })

  // update ncomments of all ancestors
  ancestors.forEach(id => {
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
