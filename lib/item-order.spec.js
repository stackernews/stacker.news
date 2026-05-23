/* eslint-env jest */

import { orderByClause, userOrderByClause } from './item-order'

describe('item order clauses', () => {
  it('keeps top sats sorting on ranktop', () => {
    expect(orderByClause('sats', 'posts')).toBe('ORDER BY "Item".ranktop DESC, "Item".id DESC')
  })

  it('sorts user sats by direct item sats', () => {
    expect(userOrderByClause('sats', 'posts')).toBe('ORDER BY "Item".msats DESC, "Item".id DESC')
  })

  it('preserves bookmark created sort for new user bookmarks', () => {
    expect(userOrderByClause('new', 'bookmarks')).toBe('ORDER BY "bookmarkCreatedAt" DESC')
  })
})
