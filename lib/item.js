import { COMMENT_DEPTH_LIMIT, OLD_ITEM_DAYS } from './constants'
import { datePivot } from './time'

export const defaultCommentSort = (pinned, bio, createdAt) => {
  // pins sort by recent
  if (pinned) return 'recent'
  // old items (that aren't bios) sort by top
  if (!bio && new Date(createdAt) < datePivot(new Date(), { days: -OLD_ITEM_DAYS })) return 'top'
  // everything else sorts by hot
  return 'hot'
}

export const isJob = item => typeof item.maxBid !== 'undefined'

// a delete directive preceded by a non word character that isn't a backtick
const deletePattern = /\B@delete\s+in\s+(\d+)\s+(second|minute|hour|day|week|month|year)s?/gi

const deleteMentionPattern = /\B@delete/i

export const hasDeleteMention = (text) => deleteMentionPattern.test(text ?? '')

export const getDeleteCommand = (text) => {
  if (!text) return false
  const matches = [...text.matchAll(deletePattern)]
  const commands = matches?.map(match => ({ number: match[1], unit: match[2] }))
  return commands.length ? commands[commands.length - 1] : undefined
}

export const hasDeleteCommand = (text) => !!getDeleteCommand(text)

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

  return await models.item.update({ where: { id: Number(id) }, data: updateData })
}

export const commentSubTreeRootId = (item) => {
  const path = item.path.split('.')
  return path.slice(-(COMMENT_DEPTH_LIMIT - 1))[0]
}
