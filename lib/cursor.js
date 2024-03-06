export const LIMIT = 21

export function decodeCursor (cursor) {
  if (!cursor) {
    return { offset: 0, time: new Date() }
  } else {
    const res = JSON.parse(Buffer.from(cursor, 'base64'))
    res.time = new Date(res.time)
    return res
  }
}

export function nextCursorEncoded (cursor, limit = LIMIT) {
  cursor.offset += limit
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}

export function nextNoteCursorEncoded (cursor, notifications = [], limit = LIMIT) {
  // what we are looking for this oldest sort time for every table we are looking at
  cursor.time = new Date(notifications.slice(-1).pop()?.sortTime ?? cursor.time)
  cursor.offset += limit
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}
