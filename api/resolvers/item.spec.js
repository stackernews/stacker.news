/* eslint-env jest */

jest.mock('./wallet', () => ({
  verifyHmac: jest.fn()
}))

jest.mock('../payIn', () => ({
  __esModule: true,
  default: jest.fn(),
  retry: jest.fn()
}))

jest.mock('../../lib/lexical/server/html', () => ({
  lexicalHTMLGenerator: jest.fn()
}))

const { getItemReferences } = require('./item')

describe('item references', () => {
  test('queries item mention referrers for an item', async () => {
    const models = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 7 }])
    }

    const result = await getItemReferences(null, { id: '42', limit: 1 }, { me: null, models })

    expect(result.items).toEqual([{ id: 7 }])
    expect(result.cursor).toEqual(expect.any(String))

    const [query, itemId, time, offset, limit] = models.$queryRawUnsafe.mock.calls[0]
    expect(query).toContain('FROM "ItemMention"')
    expect(query).toContain('JOIN "Item" ON "ItemMention"."referrerId" = "Item".id')
    expect(query).toContain('"ItemMention"."refereeId" = $1')
    expect(query).toContain('"Item"."parentId" IS NULL')
    expect(query).toContain('"Item".bio = false')
    expect(itemId).toBe(42)
    expect(time).toBeInstanceOf(Date)
    expect(offset).toBe(0)
    expect(limit).toBe(1)
  })

  test('applies viewer territory filters to item mention referrers', async () => {
    const models = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([])
    }
    const userLoader = {
      load: jest.fn().mockResolvedValue({
        commentsSatsFilter: null,
        postsSatsFilter: null,
        nsfwMode: false
      })
    }

    const result = await getItemReferences(null, { id: '42', limit: 1 }, { me: { id: 9 }, models, userLoader })

    expect(result.items).toEqual([])
    expect(result.cursor).toBeNull()
    expect(userLoader.load).toHaveBeenCalledWith(9)

    const [query] = models.$queryRawUnsafe.mock.calls[0]
    expect(query).toContain('"MuteSub"')
    expect(query).toContain('"MuteSub"."userId" = 9')
  })
})
