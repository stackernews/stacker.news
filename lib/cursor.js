export const LIMIT = 21

export function decodeCursor (cursor) {
  if (!cursor) {
    return { offset: 0, time: new Date() }
  } else {
    const res = JSON.parse(Buffer.from(cursor, 'base64'))
    res.offset = Number(res.offset)
    res.time = new Date(res.time)
    return res
  }
}

export function nextCursorEncoded (cursor, limit = LIMIT) {
  const nextCursor = { ...cursor }
  nextCursor.offset += limit
  return Buffer.from(JSON.stringify(nextCursor)).toString('base64')
}

export function itemCursorIds (cursor) {
  if (!Array.isArray(cursor?.ids)) {
    return []
  }

  return [...new Set(cursor.ids
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0))]
}

export function itemCursorOffset (cursor) {
  return itemCursorIds(cursor).length > 0 ? 0 : cursor.offset
}

export function nextItemCursorEncoded (cursor, items = [], limit = LIMIT) {
  const ids = itemCursorIds({
    ids: [
      ...itemCursorIds(cursor),
      ...items.map(item => item?.id)
    ]
  })

  const nextCursor = { ...cursor, ids }
  nextCursor.offset += limit
  return Buffer.from(JSON.stringify(nextCursor)).toString('base64')
}

export function nextNoteCursorEncoded (cursor, notifications = [], limit = LIMIT) {
  const nextCursor = { ...cursor }
  // what we are looking for this oldest sort time for every table we are looking at
  nextCursor.time = new Date(notifications.slice(-1).pop()?.sortTime ?? cursor.time)
  nextCursor.offset += limit
  return Buffer.from(JSON.stringify(nextCursor)).toString('base64')
}
