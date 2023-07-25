const COMMENTS_VIEW_PREFIX = 'commentsViewedAt'
const COMMENTS_NUM_PREFIX = 'commentsViewNum'

export function commentsViewed (item) {
  if (!item.parentId && item.lastCommentAt) {
    window.localStorage.setItem(`${COMMENTS_VIEW_PREFIX}:${item.id}`, new Date(item.lastCommentAt).getTime())
    window.localStorage.setItem(`${COMMENTS_NUM_PREFIX}:${item.id}`, item.ncomments)
  }
}

export function commentsViewedAfterComment (rootId, createdAt) {
  window.localStorage.setItem(`${COMMENTS_VIEW_PREFIX}:${rootId}`, new Date(createdAt).getTime())
  const existingRootComments = window.localStorage.getItem(`${COMMENTS_NUM_PREFIX}:${rootId}`) || 0
  window.localStorage.setItem(`${COMMENTS_NUM_PREFIX}:${rootId}`, existingRootComments + 1)
}

export function newComments (item) {
  if (!item.parentId) {
    const commentsViewedAt = window.localStorage.getItem(`${COMMENTS_VIEW_PREFIX}:${item.id}`)
    const commentsViewNum = window.localStorage.getItem(`${COMMENTS_NUM_PREFIX}:${item.id}`)

    if (commentsViewedAt && commentsViewNum) {
      return commentsViewedAt < new Date(item.lastCommentAt).getTime() || commentsViewNum < item.ncomments
    }
  }

  return false
}
