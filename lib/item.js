import { COMMENT_DEPTH_LIMIT, FULL_COMMENTS_THRESHOLD, OLD_ITEM_DAYS } from './constants'
import { datePivot } from './time'

export const defaultCommentSort = (pinned, bio, createdAt) => {
  // pins sort by recent
  if (pinned) return 'recent'
  // old items (that aren't bios) sort by top
  if (!bio && new Date(createdAt) < datePivot(new Date(), { days: -OLD_ITEM_DAYS })) return 'top'
  // everything else sorts by hot
  return 'hot'
}

export const isJob = item => item.subName === 'jobs'

// a delete directive preceded by a non word character that isn't a backtick
const deletePattern = /\B@delete\s+in\s+(\d+)\s+(second|minute|hour|day|week|month|year|block)s?/gi

// support absolute block height deletes
const deleteBlockAtPattern = /\B@delete\s+at\s+block\s+(\d+)/gi

const deleteMentionPattern = /\B@delete/i

// support time-based and block-based relative reminders,
// where unit may be seconds/minutes/etc or blocks
const reminderPattern = /\B@remindme\s+in\s+(\d+)\s+(second|minute|hour|day|week|month|year|block)s?/gi

// support absolute block height reminders
const reminderBlockAtPattern = /\B@remindme\s+at\s+block\s+(\d+)/gi

const reminderMentionPattern = /\B@remindme/i

export const hasDeleteMention = (text) => deleteMentionPattern.test(text ?? '')

export const getDeleteCommand = (text) => {
  if (!text) return false
  const matches = [...text.matchAll(deletePattern)]
  const commands = matches?.map(match => ({ number: parseInt(match[1]), unit: match[2] }))
  return commands.length ? commands[commands.length - 1] : undefined
}

export const getDeleteAt = (text, opts = {}) => {
  if (!text) return null

  const relMatches = [...text.matchAll(deletePattern)]
  const lastRel = relMatches.length ? relMatches[relMatches.length - 1] : null
  const lastRelIndex = lastRel?.index ?? -1

  const absMatches = [...text.matchAll(deleteBlockAtPattern)]
  const lastAbs = absMatches.length ? absMatches[absMatches.length - 1] : null
  const lastAbsIndex = lastAbs?.index ?? -1

  if (lastRelIndex < 0 && lastAbsIndex < 0) return null

  const now = new Date()

  if (lastAbsIndex > lastRelIndex) {
    const targetHeight = parseInt(lastAbs[1])
    const { currentBlockHeight } = opts
    if (Number.isInteger(currentBlockHeight)) {
      const delta = targetHeight - currentBlockHeight
      const minutes = Math.max(0, delta) * 10
      return datePivot(now, { minutes })
    }
    return null
  }

  const number = parseInt(lastRel[1])
  const unit = lastRel[2]
  if (unit === 'block') {
    const minutes = number * 10
    return datePivot(now, { minutes })
  }
  return datePivot(now, { [`${unit}s`]: number })
}

export const getRemindAt = (text, opts = {}) => {
  if (!text) return null

  // gather matches for relative (in N unit) including blocks
  const relMatches = [...text.matchAll(reminderPattern)]
  const lastRel = relMatches.length ? relMatches[relMatches.length - 1] : null
  const lastRelIndex = lastRel?.index ?? -1

  // gather matches for absolute (at block X)
  const absMatches = [...text.matchAll(reminderBlockAtPattern)]
  const lastAbs = absMatches.length ? absMatches[absMatches.length - 1] : null
  const lastAbsIndex = lastAbs?.index ?? -1

  // if neither present, nothing to do
  if (lastRelIndex < 0 && lastAbsIndex < 0) return null

  const now = new Date()

  // prefer the last directive that appears in the text
  if (lastAbsIndex > lastRelIndex) {
    // absolute block target
    const targetHeight = parseInt(lastAbs[1])
    const { currentBlockHeight } = opts
    if (Number.isInteger(currentBlockHeight)) {
      const delta = targetHeight - currentBlockHeight
      const minutes = Math.max(0, delta) * 10
      return datePivot(now, { minutes })
    }
    // if we don't know current height, we can't compute accurately; return null
    return null
  }

  // relative directive
  const number = parseInt(lastRel[1])
  const unit = lastRel[2]
  if (unit === 'block') {
    const minutes = number * 10
    return datePivot(now, { minutes })
  }
  return datePivot(now, { [`${unit}s`]: number })
}

export const hasDeleteCommand = (text) => !!getDeleteCommand(text)

export const hasReminderMention = (text) => reminderMentionPattern.test(text ?? '')

export const getReminderCommand = (text) => {
  if (!text) return false
  const matches = [...text.matchAll(reminderPattern)]
  const commands = matches?.map(match => ({ number: parseInt(match[1]), unit: match[2] }))
  return commands.length ? commands[commands.length - 1] : undefined
}

export const hasReminderCommand = (text) => !!getReminderCommand(text)

export const deleteItemByAuthor = async ({ models, id, item }) => {
  if (!item) {
    item = await models.item.findUnique({ where: { id: Number(id) } })
  }
  if (!item) {
    console.log('attempted to delete an item that does not exist', id)
    return
  }
  const updateData = { deletedAt: new Date() }
  if (item.text) {
    updateData.text = '*deleted by author*'
  }
  if (item.title) {
    updateData.title = 'deleted by author'
  }
  if (item.url) {
    updateData.url = null
  }
  if (item.pollCost) {
    updateData.pollCost = null
  }

  await deleteReminders({ id, userId: item.userId, models })
  return await models.item.update({ where: { id: Number(id) }, data: updateData })
}

export const deleteReminders = async ({ id, userId, models }) => {
  await models.$queryRaw`
  DELETE FROM pgboss.job
  WHERE name = 'reminder'
  AND data->>'itemId' = ${id}::TEXT
  AND data->>'userId' = ${userId}::TEXT
  AND state <> 'completed'`
  await models.reminder.deleteMany({
    where: {
      itemId: Number(id),
      userId: Number(userId),
      remindAt: {
        gt: new Date()
      }
    }
  })
}

export const commentSubTreeRootId = (item, root) => {
  if (item.root?.ncomments > FULL_COMMENTS_THRESHOLD || root?.ncomments > FULL_COMMENTS_THRESHOLD) {
    return item.id
  }

  const path = item.path.split('.')
  return path.slice(-(COMMENT_DEPTH_LIMIT - 1))[0]
}
