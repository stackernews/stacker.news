/* eslint-env jest */

import { pollSchema } from './validate'

const POLL_EXPIRATION_ERROR = 'Expiration must be at least 1 day in the future'

function validatePollExpiresAt (pollExpiresAt, schema = pollSchema({})) {
  return schema.validateAt('pollExpiresAt', { pollExpiresAt })
}

describe('pollSchema', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  describe('pollExpiresAt', () => {
    test('evaluates minimum at validation time instead of schema creation time', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date(2026, 5, 13, 0, 0, 0, 0))

      const schema = pollSchema({})
      const defaultExpiration = new Date(2026, 5, 15, 0, 0, 0, 0)

      jest.setSystemTime(new Date(2026, 5, 14, 12, 0, 0, 0, 0))

      await expect(validatePollExpiresAt(defaultExpiration, schema))
        .rejects.toThrow(POLL_EXPIRATION_ERROR)
    })

    test('rejects expiration less than one day from validation time', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date(2026, 5, 13, 0, 0, 0, 0))

      await expect(validatePollExpiresAt(new Date(2026, 5, 13, 23, 59, 59, 999)))
        .rejects.toThrow(POLL_EXPIRATION_ERROR)
    })

    test('accepts expiration at least one day from validation time', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date(2026, 5, 13, 0, 0, 0, 0))

      const expiration = new Date(2026, 5, 14, 0, 0, 0, 0)

      await expect(validatePollExpiresAt(expiration)).resolves.toEqual(expiration)
    })

    test('allows expiration to be cleared', async () => {
      await expect(validatePollExpiresAt(null)).resolves.toBeNull()
    })
  })
})
