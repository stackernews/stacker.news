/* eslint-env jest */

import { bountySchema, discussionSchema, hasUrlProtocol, jobSchema, linkSchema, pollSchema } from './validate'

const mockArgs = (postTypes = ['DISCUSSION', 'LINK', 'POLL', 'BOUNTY']) => ({
  models: {
    sub: {
      findMany: jest.fn(async ({ where: { name: { in: subNames } } }) =>
        subNames.map(name => ({ name, status: 'ACTIVE', postTypes })))
    }
  }
})

describe('title validation', () => {
  test('detects URL protocols without rejecting bare domains or non-URL URI schemes', () => {
    expect(hasUrlProtocol('https://stacker.news')).toBe(true)
    expect(hasUrlProtocol('See ftp://example.com')).toBe(true)
    expect(hasUrlProtocol('Crypto.com stadium hosts big game')).toBe(false)
    expect(hasUrlProtocol('example.com/path')).toBe(false)
    expect(hasUrlProtocol('mailto:jobs@example.com')).toBe(false)
  })

  test.each([
    ['discussion', discussionSchema(mockArgs()), { subNames: ['bitcoin'], title: 'https://example.com', text: '' }],
    ['link', linkSchema(mockArgs()), { subNames: ['bitcoin'], title: 'Read https://example.com', url: 'https://stacker.news', text: '' }],
    ['poll', pollSchema({ ...mockArgs(), numExistingChoices: 0 }), { subNames: ['bitcoin'], title: 'ftp://example.com', options: ['yes', 'no'] }],
    ['bounty', bountySchema(mockArgs()), { subNames: ['bitcoin'], title: 'bitcoin://invoice', text: '', bounty: 1000 }],
    ['job', jobSchema(mockArgs()), { title: 'Apply at https://example.com', company: 'SN', text: 'job', url: 'jobs@example.com', remote: true }]
  ])('rejects URL protocols in %s titles', async (_name, schema, value) => {
    await expect(schema.validate(value)).rejects.toThrow('title cannot contain URLs')
  })

  test('allows bare domains in titles', async () => {
    await expect(discussionSchema(mockArgs()).validate({
      subNames: ['bitcoin'],
      title: 'Crypto.com stadium hosts big game',
      text: ''
    })).resolves.toMatchObject({ title: 'Crypto.com stadium hosts big game' })
  })
})
