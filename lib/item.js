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
const deletePattern = /\B@delete\s+in\s+(\d+)\s+(second|minute|hour|day|week|month|year)s?/gi

const deleteMentionPattern = /\B@delete/i

const reminderPattern = /\B@remindme\s+in\s+(\d+)\s+(second|minute|hour|day|week|month|year)s?/gi

const reminderMentionPattern = /\B@remindme/i

export const hasDeleteMention = (text) => deleteMentionPattern.test(text ?? '')

export const getDeleteCommand = (text) => {
  if (!text) return false
  const matches = [...text.matchAll(deletePattern)]
  const commands = matches?.map(match => ({ number: parseInt(match[1]), unit: match[2] }))
  return commands.length ? commands[commands.length - 1] : undefined
}

export const getDeleteAt = (text) => {
  const command = getDeleteCommand(text)
  if (command) {
    const { number, unit } = command
    return datePivot(new Date(), { [`${unit}s`]: number })
  }
  return null
}

export const getRemindAt = (text) => {
  const command = getReminderCommand(text)
  if (command) {
    const { number, unit } = command
    return datePivot(new Date(), { [`${unit}s`]: number })
  }
  return null
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
  await models.oldItem.updateMany({ where: { originalItemId: Number(id) }, data: updateData }) // also delete old revisions
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
