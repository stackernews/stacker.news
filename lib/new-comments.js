const COMMENTS_VIEW_PREFIX = 'commentsViewedAt'
const COMMENTS_NUM_PREFIX = 'commentsViewNum'

export function commentsViewed (item) {
  if (!item.parentId && item.lastCommentAt) {
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

// Opening a comment permalink (notifications deep-link to /items/<commentId>)
// should advance the thread's viewed cursor to that comment, never backwards.
export function nextCommentsViewedAt (existing, openedAt) {
  const opened = new Date(openedAt).getTime()
  if (!Number.isFinite(opened)) return existing
  if (!existing) return opened
  const prev = new Date(existing).getTime()
  if (!Number.isFinite(prev) || prev < opened) return opened
  return prev
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
