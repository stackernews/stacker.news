exports.LIMIT = 21

exports.decodeCursor = function (cursor) {
  if (!cursor) {
    return { offset: 0, time: new Date() }
  } else {
    const res = JSON.parse(Buffer.from(cursor, 'base64'))
    res.time = new Date(res.time)
    return res
  }
}

exports.nextCursorEncoded = function (cursor, limit = exports.LIMIT) {
  cursor.offset += limit
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}
