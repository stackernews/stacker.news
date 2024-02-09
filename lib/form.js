import { hasDeleteMention } from './item'

/**
 * Normalize an array of forwards by converting the pct from a string to a number
 * Also extracts nym from nested user object, if necessary
 * @param {*} forward Array of forward objects ({nym?: string, pct: string, user?: { name: string } })
 * @returns normalized array, or undefined if not provided
 */
export const normalizeForwards = (forward) => {
  if (!Array.isArray(forward)) {
    return undefined
  }
  return forward.filter(fwd => fwd.nym || fwd.user?.name).map(fwd => ({ nym: fwd.nym ?? fwd.user?.name, pct: Number(fwd.pct) }))
}

export const toastDeleteScheduled = (toaster, upsertResponseData, dataKey, isEdit, itemText) => {
  const data = upsertResponseData[dataKey]
  if (!data) return

  const deleteMentioned = hasDeleteMention(itemText)
  const deletedScheduled = !!data.deleteScheduledAt

  if (!deleteMentioned) return
  if (deleteMentioned && !deletedScheduled) {
    // There's a delete mention but the deletion wasn't scheduled
    toaster.warning('it looks like you tried to use the delete bot but it didn\'t work. make sure you use the correct format: "@delete in n units" e.g. "@delete in 2 hours"', 10000)
    return
  }

  // when we reached this code, we know that a delete was scheduled
  const deleteScheduledAt = new Date(data.deleteScheduledAt)
  if (deleteScheduledAt) {
    const itemType = {
      upsertDiscussion: 'discussion post',
      upsertLink: 'link post',
      upsertPoll: 'poll',
      upsertBounty: 'bounty',
      upsertJob: 'job',
      upsertComment: 'comment'
    }[dataKey] ?? 'item'

    const message = `${itemType === 'comment' ? 'your comment' : isEdit ? `this ${itemType}` : `your new ${itemType}`} will be deleted at ${deleteScheduledAt.toLocaleString()}`
    toaster.success(message)
  }
}
