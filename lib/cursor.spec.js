/* eslint-env jest */

import {
  decodeCursor,
  itemCursorIds,
  itemCursorOffset,
  nextCursorEncoded,
  nextItemCursorEncoded
} from './cursor.js'

const baseCursor = () => ({
  offset: 0,
  time: new Date('2026-06-14T00:00:00.000Z')
})

describe('cursor', () => {
  test('nextCursorEncoded keeps generic cursors offset-only', () => {
    const decoded = decodeCursor(nextCursorEncoded(baseCursor()))

    expect(decoded.offset).toBe(21)
    expect(decoded.ids).toBeUndefined()
    expect(decoded.time).toEqual(baseCursor().time)
  })

  test('nextItemCursorEncoded records rendered item ids', () => {
    const decoded = decodeCursor(nextItemCursorEncoded(baseCursor(), [
      { id: '1' },
      { id: 2 },
      { id: 'not-a-number' },
      { id: 0 },
      null
    ]))

    expect(decoded.offset).toBe(21)
    expect(decoded.ids).toEqual([1, 2])
    expect(itemCursorOffset(decoded)).toBe(0)
  })

  test('nextItemCursorEncoded appends ids without duplicating them', () => {
    const firstPage = decodeCursor(nextItemCursorEncoded(baseCursor(), [
      { id: 1 },
      { id: 2 }
    ]))
    const secondPage = decodeCursor(nextItemCursorEncoded(firstPage, [
      { id: 2 },
      { id: 3 }
    ]))

    expect(secondPage.offset).toBe(42)
    expect(secondPage.ids).toEqual([1, 2, 3])
  })

  test('itemCursorOffset preserves old offset-only cursors', () => {
    expect(itemCursorOffset({ offset: 42 })).toBe(42)
  })

  test('itemCursorIds normalizes cursor ids', () => {
    expect(itemCursorIds({
      ids: [1, '2', 1, -3, 1.1, null, undefined, 'nope']
    })).toEqual([1, 2])
  })
})
