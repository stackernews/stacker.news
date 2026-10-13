/* eslint-env jest */

import { notificationViewed, newComments } from '../new-comments'

const rootItem = (overrides = {}) => ({
  id: 100,
  lastCommentAt: '2026-10-01T12:00:00Z',
  meCommentsViewedAt: null,
  ...overrides
})

const replyNotification = (itemOverrides = {}, rootOverrides = {}) => ({
  __typename: 'Reply',
  sortTime: '2026-10-01T12:00:00Z',
  item: {
    id: 55,
    parentId: 100,
    createdAt: '2026-10-01T12:00:00Z',
    root: rootItem(rootOverrides),
    ...itemOverrides
  }
})

describe('notificationViewed', () => {
  test('fresh reply notification marks its root thread viewed at lastCommentAt', () => {
    const result = notificationViewed(replyNotification(), true)
    expect(result).toEqual({
      id: 100,
      viewedAt: new Date('2026-10-01T12:00:00Z')
    })
  })

  test('stale notification returns null even for a comment item', () => {
    expect(notificationViewed(replyNotification(), false)).toBeNull()
  })

  test('post notification (title item, no parentId) returns null', () => {
    const n = replyNotification({ parentId: null })
    n.item.title = 'a post'
    expect(notificationViewed(n, true)).toBeNull()
  })

  test('notification without item returns null', () => {
    expect(notificationViewed({ __typename: 'Earn', sortTime: 1 }, true)).toBeNull()
  })

  test('comment notification without root returns null', () => {
    const n = replyNotification()
    n.item.root = null
    expect(notificationViewed(n, true)).toBeNull()
  })

  test('null notification returns null', () => {
    expect(notificationViewed(null, true)).toBeNull()
  })

  test('marked thread clears the new-comments indicator', () => {
    // after the feed marks the root viewed at lastCommentAt, the main list
    // must no longer treat the thread as having new comments (#3150)
    const root = rootItem({
      meCommentsViewedAt: '2026-10-01T12:00:00Z'
    })
    expect(newComments(root)).toBe(false)
  })
})
