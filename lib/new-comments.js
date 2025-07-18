const COMMENTS_VIEW_PREFIX = 'commentsViewedAt'
const COMMENTS_NUM_PREFIX = 'commentsViewNum'

export function commentsViewed (item) {
  if (!item.parentId && item.lastCommentAt) {
    window.localStorage.setItem(`${COMMENTS_VIEW_PREFIX}:${item.id}`, new Date(item.lastCommentAt).getTime())
    window.localStorage.setItem(`${COMMENTS_NUM_PREFIX}:${item.id}`, item.ncomments)
  }
}

export function commentsViewedAt (item) {
  return Number(window.localStorage.getItem(`${COMMENTS_VIEW_PREFIX}:${item.id}`))
}

export function commentsViewedNum (item) {
  return Number(window.localStorage.getItem(`${COMMENTS_NUM_PREFIX}:${item.id}`))
}

export function commentsViewedAfterComment (rootId, createdAt) {
  window.localStorage.setItem(`${COMMENTS_VIEW_PREFIX}:${rootId}`, new Date(createdAt).getTime())
  window.localStorage.setItem(`${COMMENTS_NUM_PREFIX}:${rootId}`, commentsViewedNum(rootId) + 1)
}

export function newComments (item) {
  if (!item.parentId) {
    const viewedAt = commentsViewedAt(item)
    const viewNum = commentsViewedNum(item)

    if (viewedAt && viewNum) {
      return viewedAt < new Date(item.lastCommentAt).getTime() || viewNum < item.ncomments
    }
  }

  return false
}
