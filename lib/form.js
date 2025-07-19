import { hasDeleteMention, hasReminderMention } from './item'

/**
 * Normalize an array of forwards by converting the pct from a string to a number
 * Also extracts nym from nested user object, if necessary and removes 0 pct fowards
 * @param {*} forward Array of forward objects ({nym?: string, pct: string, user?: { name: string } })
 * @returns normalized array, or undefined if not provided
 */
export const normalizeForwards = (forward) => {
  if (!Array.isArray(forward)) {
    return undefined
  }
  return forward.filter(fwd => (fwd.nym || fwd.user?.name) && Number(fwd.pct) > 0).map(fwd => ({ nym: fwd.nym ?? fwd.user?.name, pct: Number(fwd.pct) }))
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
