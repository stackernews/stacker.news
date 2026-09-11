/* eslint-env jest */

import { nextCommentsViewedAt } from './new-comments.js'

describe('nextCommentsViewedAt', () => {
  test('uses the opened comment when the thread was never viewed', () => {
    expect(nextCommentsViewedAt(null, '2026-07-27T12:00:00.000Z'))
      .toBe(Date.parse('2026-07-27T12:00:00.000Z'))
  })

  test('advances when opening a newer comment from notifications', () => {
    expect(nextCommentsViewedAt('2026-07-27T11:00:00.000Z', '2026-07-27T12:00:00.000Z'))
      .toBe(Date.parse('2026-07-27T12:00:00.000Z'))
  })

  test('does not move backwards if a later view already exists', () => {
    expect(nextCommentsViewedAt('2026-07-27T13:00:00.000Z', '2026-07-27T12:00:00.000Z'))
      .toBe(Date.parse('2026-07-27T13:00:00.000Z'))
  })
})
