// __tests__/nostrCrosspost.test.js
import { TextDecoder, TextEncoder } from 'util'
global.TextDecoder = TextDecoder
global.TextEncoder = TextEncoder

const mockNostr = {
  get: () => ({
    getSigner: () => ({}),
    publish: jest.fn(async (event, opts) => {
      if (global.__published) global.__published.push(event)
    })
  })
}

import { nostrCrosspost } from '../worker/nostrCrosspost'

describe('nostrCrosspost worker', () => {
  let models, boss, published, updated

  beforeEach(() => {
    published = []
    updated = []
    global.__published = published
    models = {
      item: {
        findMany: jest.fn(() => [
          { id: 1, title: 'Test', text: 'Body', pendingNostrCrosspost: true, nostrCrosspostAt: new Date(Date.now() - 1000) }
        ]),
        update: jest.fn(({ where }) => { updated.push(where.id) })
      }
    }
    boss = {}
  })

  it('crossposts eligible items and marks them as posted', async () => {
    await nostrCrosspost({ boss, models, nostrLib: mockNostr })
    expect(published.length).toBe(1)
    expect(updated).toContain(1)
  })

  it('does nothing if no eligible items', async () => {
    models.item.findMany = jest.fn(() => [])
    await nostrCrosspost({ boss, models, nostrLib: mockNostr })
    expect(published.length).toBe(0)
    expect(updated.length).toBe(0)
  })
})
