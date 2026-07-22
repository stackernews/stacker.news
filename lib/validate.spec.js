/* eslint-env jest */

import { bountySchema, discussionSchema, jobSchema, linkSchema, pollSchema } from './validate'

const titledPostSchemas = [
  ['bounty', () => bountySchema({})],
  ['discussion', () => discussionSchema({})],
  ['job', () => jobSchema({})],
  ['link', () => linkSchema({})],
  ['poll', () => pollSchema({})]
]

describe('post title validation', () => {
  test.each(titledPostSchemas)('rejects URI schemes in %s titles', async (name, createSchema) => {
    const title = 'Read https://stacker.news/items/13221'
    await expect(createSchema().validateAt('title', { title }))
      .rejects.toThrow('remove URI scheme from title')
  })

  test.each([
    'HTTPS://stacker.news should not be a title',
    'Open ipfs://bafyexample'
  ])('rejects URI schemes in titles: %s', async title => {
    await expect(discussionSchema({}).validateAt('title', { title }))
      .rejects.toThrow('remove URI scheme from title')
  })

  test.each([
    'Crypto.com stadium hosts big game',
    'What happened at stacker.news today?',
    'A title with a colon: but no URI'
  ])('allows domains and ordinary title punctuation: %s', async title => {
    await expect(discussionSchema({}).validateAt('title', { title }))
      .resolves.toBe(title)
  })
})

describe('pollSchema', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  test('rejects poll expiration less than one day in the future', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 5, 14, 1, 0, 0, 0, 0))

    await expect(pollSchema({}).validateAt('pollExpiresAt', {
      pollExpiresAt: new Date(2026, 5, 15, 0, 0, 0, 0)
    })).rejects.toThrow('Expiration must be at least 1 day in the future')
  })

  test('accepts poll expiration exactly one day in the future', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 5, 13, 0, 0, 0, 0))

    await expect(pollSchema({}).validateAt('pollExpiresAt', {
      pollExpiresAt: new Date(2026, 5, 14, 0, 0, 0, 0)
    })).resolves.toEqual(new Date(2026, 5, 14, 0, 0, 0, 0))
  })

  test('accepts poll expiration more than one day in the future', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 5, 13, 0, 0, 0, 0))

    await expect(pollSchema({}).validateAt('pollExpiresAt', {
      pollExpiresAt: new Date(2026, 5, 14, 1, 0, 0, 0)
    })).resolves.toEqual(new Date(2026, 5, 14, 1, 0, 0, 0))
  })

  test('allows poll expiration to be cleared', async () => {
    await expect(pollSchema({}).validateAt('pollExpiresAt', {
      pollExpiresAt: null
    })).resolves.toBeNull()
  })
})
