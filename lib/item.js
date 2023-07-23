import { OLD_ITEM_DAYS } from './constants'
import { dayPivot } from './time'

export const defaultCommentSort = (pinned, bio, createdAt) => {
  // pins sort by recent
  if (pinned || bio) return 'recent'
  // old items sort by top
  if (new Date(createdAt) < dayPivot(new Date(), -OLD_ITEM_DAYS)) return 'top'
  // everything else sorts by hot
  return 'hot'
}
