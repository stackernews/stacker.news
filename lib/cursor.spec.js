/* eslint-env jest */

import { decodeCursor, nextCursorEncoded } from './cursor.js'

describe('item cursors', () => {
  test('accumulates ids across pages without duplicates', () => {
    const first = decodeCursor(nextCursorEncoded({ offset: 0, time: new Date('2026-01-01'), ids: [] }, 21, [1, 2, 3]))
    const second = decodeCursor(nextCursorEncoded(first, 21, [3, 4]))

    expect(second.offset).toBe(42)
    expect(second.ids).toEqual([1, 2, 3, 4])
  })

  test('keeps only integer ids from an incoming cursor', () => {
    const cursor = Buffer.from(JSON.stringify({ offset: 0, time: '2026-01-01', ids: [1, '2', 'invalid', 1.5] })).toString('base64')

    expect(decodeCursor(cursor).ids).toEqual([1, 2])
  })
})
