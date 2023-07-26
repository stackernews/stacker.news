import { OLD_ITEM_DAYS } from './constants'
import { dayPivot } from './time'

export const defaultCommentSort = (pinned, bio, createdAt) => {
  // pins sort by recent
  if (pinned) return 'recent'
  // old items (that aren't bios) sort by top
  if (!bio && new Date(createdAt) < dayPivot(new Date(), -OLD_ITEM_DAYS)) return 'top'
  // everything else sorts by hot
  return 'hot'
}
