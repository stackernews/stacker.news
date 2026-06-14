/* eslint-env jest */

import { itemOrderByClause } from './item.js'

describe('itemOrderByClause', () => {
  test('sorts user profile sats by the visible item sats total', () => {
    const orderBy = itemOrderByClause({ by: 'sats', sort: 'user', type: 'posts' })

    expect(orderBy).toBe('ORDER BY (COALESCE("Item".msats, 0) + ((COALESCE("Item".boost, 0) + COALESCE("Item".cost, 0))::BIGINT * 1000)) DESC, "Item".id DESC')
    expect(orderBy).not.toContain('ranktop')
    expect(orderBy).not.toContain('comment')
  })

  test('keeps global sats sorting on ranktop', () => {
    expect(itemOrderByClause({ by: 'sats', sort: 'top', type: 'posts' }))
      .toBe('ORDER BY "Item".ranktop DESC, "Item".id DESC')
  })

  test('sorts by comments', () => {
    expect(itemOrderByClause({ by: 'comments', sort: 'user', type: 'posts' }))
      .toBe('ORDER BY "Item".ncomments DESC')
  })

  test('sorts by downsats', () => {
    expect(itemOrderByClause({ by: 'downsats', sort: 'user', type: 'posts' }))
      .toBe('ORDER BY "Item"."downMsats" DESC')
  })

  test('defaults posts to newest first', () => {
    expect(itemOrderByClause({ sort: 'user', type: 'posts' }))
      .toBe('ORDER BY "Item".created_at DESC')
  })

  test('defaults bookmarks to bookmark creation time', () => {
    expect(itemOrderByClause({ sort: 'user', type: 'bookmarks' }))
      .toBe('ORDER BY "bookmarkCreatedAt" DESC')
  })
})
