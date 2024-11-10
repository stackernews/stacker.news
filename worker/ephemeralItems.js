import { deleteItemByAuthor } from '@/lib/item'

export async function deleteItem ({ data: { id }, models }) {
  await deleteItemByAuthor({ models, id })
}
