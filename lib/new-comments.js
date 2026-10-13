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

// A fresh notification whose item is a comment renders that comment inline in
// the notifications feed (see NoteItem), so the thread it belongs to has been
// seen exactly as if the user had opened the item page: mark the root's
// meCommentsViewedAt at its lastCommentAt. Post summaries (title set), notes
// without an item, and stale (already-checked) notifications leave the "new
// comments" indicator untouched. Returns null when there is nothing to mark.
export function notificationViewed (n, fresh) {
  const item = n?.item
  if (!fresh || !item?.parentId) return null

  const root = item.root
  if (!root?.id || !root?.lastCommentAt) return null

  return { id: root.id, viewedAt: new Date(root.lastCommentAt) }
}
