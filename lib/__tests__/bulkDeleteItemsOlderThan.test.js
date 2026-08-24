/* eslint-env jest */

import { bulkDeleteItemsOlderThan, DELETE_OLDER_THAN_BATCH_LIMIT } from '@/lib/item'

const mockModels = () => {
  const models = {
    item: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
    reminder: { deleteMany: jest.fn().mockResolvedValue({}) },
    $queryRaw: jest.fn().mockResolvedValue(undefined)
  }
  return models
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('bulkDeleteItemsOlderThan', () => {
  test('targets only the user\'s own, not-yet-deleted, non-bio items older than the cutoff', async () => {
    const models = mockModels()
    await bulkDeleteItemsOlderThan(models, { userId: '42', olderThanDays: 30 })
    const { where } = models.item.findMany.mock.calls[0][0]
    expect(where.userId).toBe(42)
    expect(where.deletedAt).toBeNull()
    expect(where.bio).toBe(false)
    const ageMs = Date.now() - where.createdAt.lt.getTime()
    // 30 days +/- a few seconds of test execution
    expect(ageMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
    expect(ageMs).toBeLessThan(31 * 24 * 60 * 60 * 1000)
  })

  test('never processes more than DELETE_OLDER_THAN_BATCH_LIMIT items per call', async () => {
    const models = mockModels()
    await bulkDeleteItemsOlderThan(models, { userId: 1, olderThanDays: 7 })
    expect(models.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: DELETE_OLDER_THAN_BATCH_LIMIT })
    )
    expect(DELETE_OLDER_THAN_BATCH_LIMIT).toBe(500)
  })

  test('kind=POSTS matches parentId null, kind=COMMENTS matches parentId not null', async () => {
    const models = mockModels()
    await bulkDeleteItemsOlderThan(models, { userId: 1, olderThanDays: 7, kind: 'POSTS' })
    expect(models.item.findMany.mock.calls[0][0].where.parentId).toBeNull()
    await bulkDeleteItemsOlderThan(models, { userId: 1, olderThanDays: 7, kind: 'COMMENTS' })
    expect(models.item.findMany.mock.calls[1][0].where.parentId).toEqual({ not: null })
  })

  test('scrubs text, title, url and poll cost like a single delete does', async () => {
    const models = mockModels()
    models.item.findMany.mockResolvedValue([
      { id: 1, text: 'foo', title: null, url: null, pollCost: null, userId: 7 },
      { id: 2, text: null, title: 't', url: 'https://x.co', pollCost: 100, userId: 7 }
    ])
    const count = await bulkDeleteItemsOlderThan(models, { userId: 7, olderThanDays: 1 })
    expect(count).toBe(2)
    expect(models.item.update).toHaveBeenCalledTimes(2)

    const firstUpdate = models.item.update.mock.calls[0][0]
    expect(firstUpdate.where).toEqual({ id: 1 })
    expect(firstUpdate.data.deletedAt).toBeInstanceOf(Date)
    expect(firstUpdate.data.text).toBe('*deleted by author*')
    // fields that were empty stay untouched
    expect(firstUpdate.data).not.toHaveProperty('title')
    expect(firstUpdate.data).not.toHaveProperty('url')

    const secondUpdate = models.item.update.mock.calls[1][0]
    expect(secondUpdate.data.title).toBe('deleted by author')
    expect(secondUpdate.data.url).toBeNull()
    expect(secondUpdate.data.pollCost).toBeNull()
  })

  test('clears pending reminders for every deleted item', async () => {
    const models = mockModels()
    models.item.findMany.mockResolvedValue([{ id: 9, text: 'x', title: null, url: null, pollCost: null, userId: 7 }])
    await bulkDeleteItemsOlderThan(models, { userId: 7, olderThanDays: 1 })
    expect(models.$queryRaw).toHaveBeenCalled()
    expect(models.reminder.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ itemId: 9, userId: 7 }) })
    )
  })
})
