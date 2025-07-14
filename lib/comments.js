import { COMMENT_DEPTH_LIMIT } from './constants'
import { commentUpdateFragment, getLatestCommentCreatedAt } from '../components/use-live-comments'
import { commentsViewedAfterComment } from './new-comments'
import { COMMENT_WITH_NEW_RECURSIVE } from '../fragments/comments'

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
export function dedupeNewComments (newComments, comments) {
  const existingIds = new Set(comments.map(c => c.id))
  return newComments.filter(id => !existingIds.has(id))
}

export function collectAllNewComments (item, currentDepth = 1) {
  const allNewComments = [...(item.newComments || [])]
  if (item.comments?.comments && currentDepth < (COMMENT_DEPTH_LIMIT - 1)) {
    for (const comment of item.comments.comments) {
      allNewComments.push(...collectAllNewComments(comment, currentDepth + 1))
    }
  }
  return allNewComments
}

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

    return {
      ...data,
      comments: { ...data.comments, comments: [...freshNewComments, ...data.comments.comments] },
      ncomments: data.ncomments + totalNComments,
      newComments: []
    }
  }
}

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
