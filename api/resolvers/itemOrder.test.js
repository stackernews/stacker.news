/* eslint-env jest */

import { itemOrderByClause } from './itemOrder'

describe('itemOrderByClause', () => {
  it('sorts user items by the sats shown on the item', () => {
    expect(itemOrderByClause({ by: 'sats', sort: 'user' }))
      .toBe('ORDER BY "Item".msats DESC, "Item".id DESC')
  })

  it('keeps ranktop for non-user sats feeds', () => {
    expect(itemOrderByClause({ by: 'sats', sort: 'top' }))
      .toBe('ORDER BY "Item".ranktop DESC, "Item".id DESC')
  })

  it.each([
    ['comments', undefined, 'ORDER BY "Item".ncomments DESC'],
    ['downsats', undefined, 'ORDER BY "Item"."downMsats" DESC'],
    ['new', 'bookmarks', 'ORDER BY "bookmarkCreatedAt" DESC'],
    ['new', 'posts', 'ORDER BY "Item".created_at DESC']
  ])('preserves the %s ordering', (by, type, expected) => {
    expect(itemOrderByClause({ by, type, sort: 'user' })).toBe(expected)
  })
})
