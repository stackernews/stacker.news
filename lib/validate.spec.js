/* eslint-env jest */

import { pollSchema } from './validate'

describe('pollSchema', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  test('evaluates poll expiration minimum at validation time', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 5, 13, 0, 0, 0, 0))

    const schema = pollSchema({})
    const defaultExpiration = new Date(2026, 5, 15, 0, 0, 0, 0)

    jest.setSystemTime(new Date(2026, 5, 14, 12, 0, 0, 0, 0))

    await expect(schema.validateAt('pollExpiresAt', { pollExpiresAt: defaultExpiration }))
      .rejects.toThrow('Expiration must be at least 1 day in the future')
  })

  test('accepts poll expiration at least one day from validation time', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 5, 13, 0, 0, 0, 0))

    await expect(pollSchema({}).validateAt('pollExpiresAt', {
      pollExpiresAt: new Date(2026, 5, 14, 0, 0, 0, 0)
    })).resolves.toEqual(new Date(2026, 5, 14, 0, 0, 0, 0))
  })

  test('allows poll expiration to be cleared', async () => {
    await expect(pollSchema({}).validateAt('pollExpiresAt', { pollExpiresAt: null }))
      .resolves.toBeNull()
  })
})
