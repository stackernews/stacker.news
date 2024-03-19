import { deleteItemByAuthor } from '@/lib/item.js'

export async function deleteItem ({ data: { id }, models }) {
  await deleteItemByAuthor({ models, id })
}
