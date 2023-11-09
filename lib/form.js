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

export const toastDeleteScheduled = (toaster, upsertResponseData, isEdit, itemText) => {
  const keys = Object.keys(upsertResponseData)
  const data = upsertResponseData[keys[0]]
  if (!data) return
  const deleteScheduledAt = data.deleteScheduledAt ? new Date(data.deleteScheduledAt) : undefined
  if (deleteScheduledAt) {
    const itemType = {
      upsertDiscussion: 'discussion post',
      upsertLink: 'link post',
      upsertPoll: 'poll',
      upsertBounty: 'bounty',
      upsertJob: 'job',
      upsertComment: 'comment'
    }[keys[0]] ?? 'item'

    const message = `${itemType === 'comment' ? 'your comment' : isEdit ? `this ${itemType}` : `your new ${itemType}`} will be deleted at ${deleteScheduledAt.toLocaleString()}`
    toaster.success(message)
    return
  }
  if (hasDeleteMention(itemText)) {
    // There's a delete mention but the deletion wasn't scheduled
    toaster.warning('it looks like you tried to use the delete bot but it didn\'t work. make sure you use the correct format: "@delete in n units" e.g. "@delete in 2 hours"', 10000)
  }
}
