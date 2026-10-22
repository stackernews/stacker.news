import { describe, test, afterEach, mock } from 'node:test'
import { expect } from 'expect'

import { pollSchema } from './validate'

function setSystemTime (date) {
  mock.timers.enable({
    apis: ['Date'],
    now: date
  })
}

describe('pollSchema', () => {
  afterEach(() => {
    mock.timers.reset()
  })

  test('rejects poll expiration less than one day in the future', async () => {
    setSystemTime(new Date(2026, 5, 14, 1, 0, 0, 0, 0))

    await expect(pollSchema({}).validateAt('pollExpiresAt', {
      pollExpiresAt: new Date(2026, 5, 15, 0, 0, 0, 0)
    })).rejects.toThrow('Expiration must be at least 1 day in the future')
  })

  test('accepts poll expiration exactly one day in the future', async () => {
    setSystemTime(new Date(2026, 5, 13, 0, 0, 0, 0))

    await expect(pollSchema({}).validateAt('pollExpiresAt', {
      pollExpiresAt: new Date(2026, 5, 14, 0, 0, 0, 0)
    })).resolves.toEqual(new Date(2026, 5, 14, 0, 0, 0, 0))
  })

  test('accepts poll expiration more than one day in the future', async () => {
    setSystemTime(new Date(2026, 5, 13, 0, 0, 0, 0))

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
