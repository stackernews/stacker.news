import { GqlInputError } from '@/lib/error'
import { encodeCursor } from '@/lib/cursor'

export function itemKeysetCursor (encodedCursor, cursor) {
  if (!encodedCursor) return null

  if (cursor.key == null ||
    !Number.isInteger(Number(cursor.id)) || Number(cursor.id) <= 0) {
    throw new GqlInputError('invalid cursor')
  }

  return {
    key: cursor.key,
    id: Number(cursor.id)
  }
}

export function updateItemKeysetCursor (cursor, items, limit) {
  if (items.length !== limit) return

  let { cursorSort: key, id } = items.at(-1)
  if (typeof key === 'bigint') key = key.toString()
  Object.assign(cursor, { key, id })
}

export function encodeItemKeysetCursor ({ time, key, id }) {
  return encodeCursor({ time, key, id })
}
