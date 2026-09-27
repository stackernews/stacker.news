/* eslint-env jest */

import resolvers from './search'
import { getItem } from './item'
import { resolveOpensearchModelId } from '../search/model-id'

jest.mock('./item', () => ({
  getItem: jest.fn(),
  itemQueryWithMeta: jest.fn(),
  SELECT: ''
}))
jest.mock('@/lib/cursor', () => jest.requireActual('../../lib/cursor'), { virtual: true })
jest.mock('@/lib/time', () => jest.requireActual('../../lib/time'), { virtual: true })
jest.mock('@/lib/constants', () => jest.requireActual('../../lib/constants'), { virtual: true })
jest.mock('@/lib/validate', () => ({}), { virtual: true })
jest.mock('../search/model-id', () => ({ resolveOpensearchModelId: jest.fn() }))
jest.mock('@prisma/client', () => ({
  Prisma: { sql: require('@prisma/client/runtime/library').sqltag }
}))

describe.each([null, 'test-model'])('related posts with model %s', modelId => {
  let models
  let search

  beforeEach(() => {
    jest.clearAllMocks()
    resolveOpensearchModelId.mockResolvedValue(modelId)
    getItem.mockResolvedValue({ title: 'Bitcoin mining', text: 'Mining with renewable energy' })
    models = { mute: { findMany: jest.fn().mockResolvedValue([]) } }
    search = { search: jest.fn().mockResolvedValue({ body: { hits: { hits: [] } } }) }
  })

  function exclusions () {
    const query = search.search.mock.calls[0][0].body.query
    const filters = query.hybrid
      ? query.hybrid.filter.bool.filter
      : query.function_score.query.bool.filter
    return filters.flatMap(filter => filter.bool?.must_not || [])
  }

  test.each([{ id: '123' }, { title: 'Bitcoin mining' }])('excludes muted authors for %j', async args => {
    models.mute.findMany.mockResolvedValue([{ mutedId: 42 }, { mutedId: 43 }])

    await resolvers.Query.related(null, { ...args, limit: 5 }, { me: { id: 7 }, models, search })

    expect(exclusions()).toContainEqual({ terms: { userId: [42, 43] } })
    expect(models.mute.findMany).toHaveBeenCalledWith({
      where: { muterId: 7 },
      select: { mutedId: true }
    })
    expect(exclusions()).toContainEqual({ exists: { field: 'parentId' } })
    if (args.id) expect(exclusions()).toContainEqual({ term: { id: args.id } })
    expect(search.search.mock.calls[0][0]).toMatchObject({ size: 5, from: 0 })
  })

  test('omits the author exclusion when no users are muted', async () => {
    await resolvers.Query.related(null, { title: 'Bitcoin mining', limit: 5 }, { me: { id: 7 }, models, search })

    expect(exclusions()).toEqual([{ exists: { field: 'parentId' } }])
  })

  test('does not look up mutes for anonymous viewers', async () => {
    await resolvers.Query.related(null, { title: 'Bitcoin mining', limit: 5 }, { me: null, models, search })

    expect(models.mute.findMany).not.toHaveBeenCalled()
    expect(exclusions()).toEqual([{ exists: { field: 'parentId' } }])
  })
})
