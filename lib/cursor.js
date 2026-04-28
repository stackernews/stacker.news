export const LIMIT = 21

export function decodeCursor (cursor) {
  if (!cursor) {
    return { offset: 0, time: new Date() }
  } else {
    try {
      const res = JSON.parse(Buffer.from(cursor, 'base64'))
      res.offset = res.offset ? Number(res.offset) : 0
      res.time = res.time ? new Date(res.time) : new Date()
      return res
    } catch (e) {
      return { offset: 0, time: new Date() }
    }
  }
}

export function nextCursorEncoded (cursor, items = [], limit = LIMIT, sortField = null, idField = 'id') {
  const nextCursor = { ...cursor }
  if (items.length > 0 && sortField) {
    const lastItem = items[items.length - 1]
    nextCursor.id = lastItem[idField]
    nextCursor.sortValue = lastItem[sortField]
    // handle date objects
    if (nextCursor.sortValue instanceof Date) {
      nextCursor.sortValue = nextCursor.sortValue.getTime()
    }
  }
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
