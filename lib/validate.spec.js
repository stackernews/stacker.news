/* eslint-env jest */

import { bountySchema, discussionSchema, jobSchema, linkSchema, pollSchema } from './validate.js'

const titleSchemas = [
  ['bounty', bountySchema({})],
  ['discussion', discussionSchema({})],
  ['job', jobSchema({})],
  ['link', linkSchema({})],
  ['poll', pollSchema({})]
]

describe('title validation', () => {
  test.each(titleSchemas)('rejects URL schemes in %s titles', async (_, schema) => {
    await expect(schema.validateAt('title', { title: 'Read https://example.com now' }))
      .rejects.toThrow('remove the URL scheme from title')
  })

  test.each(titleSchemas)('allows bare domains in %s titles', async (_, schema) => {
    await expect(schema.validateAt('title', { title: 'Crypto.com stadium hosts big game' }))
      .resolves.toBe('Crypto.com stadium hosts big game')
  })
})
