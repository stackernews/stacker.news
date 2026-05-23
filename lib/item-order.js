export function orderByClause (by, type) {
  switch (by) {
    case 'comments':
      return 'ORDER BY "Item".ncomments DESC'
    case 'sats':
      return 'ORDER BY "Item".ranktop DESC, "Item".id DESC'
    case 'downsats':
      return 'ORDER BY "Item"."downMsats" DESC'
    default:
      return `ORDER BY ${type === 'bookmarks' ? '"bookmarkCreatedAt"' : '"Item".created_at'} DESC`
  }
}

export function userOrderByClause (by, type) {
  if (by === 'sats') {
    return 'ORDER BY "Item".msats DESC, "Item".id DESC'
  }

  return orderByClause(by, type)
}
