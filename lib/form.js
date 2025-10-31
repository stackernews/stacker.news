import { hasDeleteMention, hasReminderMention } from './item'

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
  // Convert to normalized objects and filter out entries with no recipient
  // and entries with a zero/invalid percentage. Users sometimes type '0'
  // to mean blank; treat those as empty and drop them before sending to the server.
  return forward
    .map(fwd => ({ nym: fwd.nym ?? fwd.user?.name, pct: Number(fwd.pct) }))
    .filter(fwd => fwd.nym && fwd.pct > 0)
}

export const toastUpsertSuccessMessages = (toaster, upsertResponseData, dataKey, itemText) => {
  const SCHEDULERS = {
    delete: {
      hasMention: hasDeleteMention,
      scheduledAtKey: 'deleteScheduledAt',
      mention: '@delete'
    },
    remindme: {
      hasMention: hasReminderMention,
      scheduledAtKey: 'reminderScheduledAt',
      mention: '@remindme'
    }
  }

  for (const key in SCHEDULERS) {
    const { hasMention, scheduledAtKey, mention } = SCHEDULERS[key]
    if (hasMention(itemText)) {
      const scheduledAt = upsertResponseData[dataKey]?.result?.[scheduledAtKey]
      const options = { persistOnNavigate: dataKey !== 'upsertComment' }
      if (scheduledAt) {
        toaster.success(`${mention} bot will trigger at ${new Date(scheduledAt).toLocaleString()}`, options)
      } else {
        toaster.warning(`It looks like you tried to use the ${mention} bot but it didn't work. Make sure you use the correct format: "${mention} in n units" e.g. "${mention} in 2 hours"`, options)
      }
    }
  }
}
