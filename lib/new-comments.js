const COMMENTS_VIEW_PREFIX = 'commentsViewedAt'
const COMMENTS_NUM_PREFIX = 'commentsViewNum'
const COMMENTS_NUM_PREFIX_THREAD = 'commentsViewNumThread'
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

export function commentsViewedAt (item) {
  return window.localStorage.getItem(`${COMMENTS_VIEW_PREFIX}:${item.id}`)
}

export function newComments (item) {
  if (!item.parentId) {
    const viewedAt = commentsViewedAt(item)
    const viewNum = window.localStorage.getItem(`${COMMENTS_NUM_PREFIX}:${item.id}`)

    if (viewedAt && viewNum) {
      return viewedAt < new Date(item.lastCommentAt).getTime() || viewNum < item.ncomments
    }
  }

  return false
}

export function commentThreadNumViewed (item) {
  window.localStorage.setItem(`${COMMENTS_NUM_PREFIX_THREAD}:${item.id}`, item.ncomments)
}

export function commentThreadNum (item) {
  return window.localStorage.getItem(`${COMMENTS_NUM_PREFIX_THREAD}:${item.id}`)
}
