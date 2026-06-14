/* global describe, expect, jest, test */

import { injectComment } from './comments'

function makeComment (overrides = {}) {
  return {
    id: 3,
    parentId: 1,
    path: '1.3',
    cost: 0,
    ...overrides
  }
}

function makeCache ({ hasParentComments = true } = {}) {
  return {
    readFragment: jest.fn(() => hasParentComments ? { comments: [] } : null),
    writeFragment: jest.fn(() => ({ __ref: 'Item:3' })),
    modify: jest.fn(({ fields }) => {
      fields.comments?.({ comments: [] }, { readField: jest.fn() })
      return true
    })
  }
}

describe('injectComment', () => {
  test('returns rendered when a live comment is written into the cache', () => {
    const cache = makeCache()

    const result = injectComment(cache, makeComment(), {
      live: true,
      rootId: 1,
      optimistic: false
    })

    expect(result).toBe('rendered')
    expect(cache.writeFragment).toHaveBeenCalled()
    expect(cache.modify).toHaveBeenCalledWith(expect.objectContaining({
      id: 'Item:1',
      optimistic: false
    }))
  })

  test('returns hidden when a live reply parent is not in the cache', () => {
    const cache = makeCache({ hasParentComments: false })

    const result = injectComment(cache, makeComment({
      parentId: 2,
      path: '1.2.3'
    }), {
      live: true,
      rootId: 1,
      optimistic: false
    })

    expect(result).toBe('hidden')
    expect(cache.writeFragment).not.toHaveBeenCalled()
    expect(cache.modify).toHaveBeenCalledWith(expect.objectContaining({
      id: 'Item:2',
      optimistic: false
    }))
    expect(cache.modify).toHaveBeenCalledWith(expect.objectContaining({
      id: 'Item:1',
      optimistic: false
    }))
  })
})
