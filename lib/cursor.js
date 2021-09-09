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

export function nextCursorEncoded (cursor) {
  cursor.offset += LIMIT
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}
