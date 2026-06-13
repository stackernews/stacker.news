/* eslint-env jest */

import { userSchema } from './validate'

describe('userSchema', () => {
  const models = {
    user: {
      findUnique: jest.fn()
    }
  }

  beforeEach(() => {
    models.user.findUnique.mockReset()
  })

  test.each(['404', '500', 'api', 'wallet', 'anon', 'ad'])('rejects reserved nym %s', async name => {
    await expect(userSchema({ models }).validate({ name })).rejects.toThrow('reserved')
    expect(models.user.findUnique).not.toHaveBeenCalled()
  })

  test('allows available non-reserved nym', async () => {
    models.user.findUnique.mockResolvedValue(null)

    await expect(userSchema({ models }).validate({ name: 'stacker_123' })).resolves.toEqual({ name: 'stacker_123' })
    expect(models.user.findUnique).toHaveBeenCalledWith({ where: { name: 'stacker_123' } })
  })
})
