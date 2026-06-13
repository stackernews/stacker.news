/* eslint-env jest */

import { newHiddenComments } from './new-comments.js'

describe('newHiddenComments', () => {
  test('detects hidden replies newer than a logged-in viewer timestamp', () => {
    expect(newHiddenComments({
      item: { lastCommentAt: '2026-06-13T10:00:00.000Z' },
      root: { meCommentsViewedAt: '2026-06-13T09:00:00.000Z' },
      meId: 1
    })).toBe(true)
  })

  test('detects hidden replies newer than an anon viewer timestamp', () => {
    expect(newHiddenComments({
      item: { lastCommentAt: '2026-06-13T10:00:00.000Z' },
      commentsViewedAt: new Date('2026-06-13T09:00:00.000Z').getTime()
    })).toBe(true)
  })

  test('ignores hidden replies already seen by the viewer', () => {
    expect(newHiddenComments({
      item: { lastCommentAt: '2026-06-13T09:00:00.000Z' },
      root: { meCommentsViewedAt: '2026-06-13T10:00:00.000Z' },
      meId: 1
    })).toBe(false)
  })

  test('ignores comments without subtree activity data', () => {
    expect(newHiddenComments({
      item: {},
      root: { meCommentsViewedAt: '2026-06-13T09:00:00.000Z' },
      meId: 1
    })).toBe(false)
  })
})
