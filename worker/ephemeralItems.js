import { deleteItemByAuthor } from '../lib/item.js'

export function deleteItem ({ models }) {
  return async function ({ data: eventData }) {
    console.log('deleteItem', eventData)
    const { id } = eventData
    try {
      await deleteItemByAuthor({ models, id })
    } catch (err) {
      console.error('failed to delete item', err)
    }
  }
}
