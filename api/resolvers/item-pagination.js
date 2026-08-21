import { GqlInputError } from '@/lib/error'

const FIRST_ITEM_ID = 2147483647
const FIRST_BIGINT = '9223372036854775807'

export function itemKeysetSql (sort, type, keyParam, idParam) {
  let expression, cast, firstKey

  switch (sort) {
    case 'new':
      expression = 'COALESCE("Item"."paidAt", "Item".created_at)'
      cast = 'TIMESTAMP'
      firstKey = 'infinity'
      break
    case 'lit':
      expression = '"Item".ranklit'
      cast = 'DOUBLE PRECISION'
      firstKey = 'Infinity'
      break
    case 'comments':
      expression = '"Item".ncomments'
      cast = 'INTEGER'
      firstKey = FIRST_ITEM_ID
      break
    case 'sats':
      expression = '"Item".ranktop'
      cast = 'DOUBLE PRECISION'
      firstKey = 'Infinity'
      break
    case 'downsats':
      expression = '"Item"."downMsats"'
      cast = 'BIGINT'
      firstKey = FIRST_BIGINT
      break
    default:
      expression = type === 'bookmarks'
        ? '"Bookmark".created_at'
        : '"Item".created_at'
      cast = 'TIMESTAMP'
      firstKey = 'infinity'
  }

  return {
    firstKey,
    cursorSelect: `${expression} AS "cursorSort"`,
    boundary: `(${expression}, "Item".id) < ($${keyParam}::${cast}, $${idParam}::INTEGER)`,
    orderBy: 'ORDER BY "cursorSort" DESC, "Item".id DESC'
  }
}

export function itemKeysetBoundary (encodedCursor, cursor, firstKey) {
  if (encodedCursor && (cursor.key == null ||
    !Number.isInteger(Number(cursor.id)) || Number(cursor.id) <= 0)) {
    throw new GqlInputError('invalid cursor')
  }

  return {
    key: cursor.key ?? firstKey,
    id: Number(cursor.id ?? FIRST_ITEM_ID)
  }
}

export function updateItemKeysetCursor (cursor, items, limit) {
  if (items.length !== limit) return

  let { cursorSort: key, id } = items.at(-1)
  if (typeof key === 'bigint') key = key.toString()
  Object.assign(cursor, { key, id })
}
