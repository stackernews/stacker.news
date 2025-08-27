const COMMENTS_VIEW_PREFIX = 'commentsViewedAt'
const COMMENTS_NUM_PREFIX = 'commentsViewNum'

export function commentsViewed (item) {
  // TODO: this used to have item.parentId check, but it got removed to allow tracking of all levels comments
  if (item.lastCommentAt) {
    window.localStorage.setItem(`${COMMENTS_VIEW_PREFIX}:${item.id}`, new Date(item.lastCommentAt).getTime())
    window.localStorage.setItem(`${COMMENTS_NUM_PREFIX}:${item.id}`, item.ncomments)
  }
}

export function commentsViewedAt (itemId) {
  return Number(window.localStorage.getItem(`${COMMENTS_VIEW_PREFIX}:${itemId}`))
}

export function commentsViewedNum (itemId) {
  return Number(window.localStorage.getItem(`${COMMENTS_NUM_PREFIX}:${itemId}`))
}

export function commentsViewedAfterComment (rootId, createdAt, ncomments = 1) {
  window.localStorage.setItem(`${COMMENTS_VIEW_PREFIX}:${rootId}`, new Date(createdAt).getTime())
  window.localStorage.setItem(`${COMMENTS_NUM_PREFIX}:${rootId}`, commentsViewedNum(rootId) + ncomments)
}

export function newComments (item) {
  if (!item.parentId && item.lastCommentAt) {
    // if logged, prefer server-tracked view
    if (item.meCommentsViewedAt) {
      const viewedAt = new Date(item.meCommentsViewedAt).getTime()
      return viewedAt < new Date(item.lastCommentAt).getTime()
    }

    // anon fallback
    const viewedAt = commentsViewedAt(item.id)
    const viewNum = commentsViewedNum(item.id)

    if (viewedAt && viewNum) {
      return viewedAt < new Date(item.lastCommentAt).getTime() || viewNum < item.ncomments
    }
  }

  return false
}
