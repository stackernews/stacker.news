export function itemOrderByClause ({ by, type, sort }) {
  switch (by) {
    case 'comments':
      return 'ORDER BY "Item".ncomments DESC'
    case 'sats':
      return sort === 'user'
        ? 'ORDER BY "Item".msats DESC, "Item".id DESC'
        : 'ORDER BY "Item".ranktop DESC, "Item".id DESC'
    case 'downsats':
      return 'ORDER BY "Item"."downMsats" DESC'
    default:
      return `ORDER BY ${type === 'bookmarks' ? '"bookmarkCreatedAt"' : '"Item".created_at'} DESC`
  }
}
