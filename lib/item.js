import { COMMENT_DEPTH_LIMIT, COMMENTS_OF_COMMENT_LIMIT, FULL_COMMENTS_THRESHOLD } from './constants'
import { datePivot } from './time'

export const defaultCommentSort = (pinned, bio, createdAt) => {
  // pins sort by new
  if (pinned) return 'new'
  // everything else sorts by lit
  return 'lit'
}

export const isJob = item => item.subNames.includes('jobs')

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
  const path = item.path.split('.')

  // if this is a limited comment tree, we can't be sure comments at our depth are visible
  // beyond COMMENTS_OF_COMMENT_LIMIT, so COMMENTS_OF_COMMENT_LIMIT is the max depth we can navigate to
  if (item.root?.ncomments > FULL_COMMENTS_THRESHOLD || root?.ncomments > FULL_COMMENTS_THRESHOLD) {
    return path.slice(-COMMENTS_OF_COMMENT_LIMIT)[0]
  }
  return path.slice(-(COMMENT_DEPTH_LIMIT - 1))[0]
}

// safety rail for bulk deletion: one batch per call so a misclick (or a bug)
// can never wipe more than DELETE_OLDER_THAN_BATCH_LIMIT items at once
export const DELETE_OLDER_THAN_BATCH_LIMIT = 500

// soft-deletes the user's own posts/comments older than `olderThanDays` days,
// reusing deleteItemByAuthor so scrubbing semantics stay identical to single deletes
export const bulkDeleteItemsOlderThan = async (models, { userId, olderThanDays, kind }) => {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const where = {
    userId: Number(userId),
    deletedAt: null,
    bio: false,
    createdAt: { lt: cutoff }
  }
  if (kind === 'POSTS') where.parentId = null
  if (kind === 'COMMENTS') where.parentId = { not: null }

  const items = await models.item.findMany({
    where,
    orderBy: { id: 'asc' },
    take: DELETE_OLDER_THAN_BATCH_LIMIT,
    select: { id: true, text: true, title: true, url: true, pollCost: true, userId: true }
  })
  for (const item of items) {
    await deleteItemByAuthor({ models, id: item.id, item })
  }
  return items.length
}
