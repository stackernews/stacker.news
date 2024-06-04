import { BloomFilter } from 'bloom-filters'
export const LIMIT = 21

const newFilter = () => new BloomFilter(1000, 4)

export function decodeCursor(cursor) {
  if (!cursor) {
    return { offset: 0, time: new Date(), filters: newFilter() }
  } else {
    const res = JSON.parse(Buffer.from(cursor, 'base64'))
    try {
      res.filters = BloomFilter.fromJSON(res.filters);
    } catch (e) {
    }
    res.filters = res.filters || newFilter()
    res.time = new Date(res.time)
    return res
  }
}

export function PaginateResult(cursor, paginated_items, object, limit = LIMIT) {
  object[paginated_items] = object[paginated_items]
    .filter(x => !cursor.filters.has(x.id.toString()));
  const ids = object[paginated_items].map(x => x.id.toString());

  return {
    cursor: ids.length === limit ? nextCursorEncoded(cursor, ids) : null,
    ...object
  };
}

export function nextCursorEncoded(cursor, ids = null, limit = LIMIT) {
  cursor.offset += limit
  if (ids) {
    for (const id of ids) {
      cursor.filters.add(id)
    }
  }
  cursor.filters = cursor.filters.saveAsJSON();
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}

export function nextNoteCursorEncoded(cursor, notifications = [], limit = LIMIT) {
  // what we are looking for this oldest sort time for every table we are looking at
  cursor.time = new Date(notifications.slice(-1).pop()?.sortTime ?? cursor.time)
  cursor.offset += limit
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}
