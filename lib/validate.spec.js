/* eslint-env jest */

import { bountySchema, discussionSchema, jobSchema, linkSchema, pollSchema } from './validate'

const models = {
  sub: {
    findMany: jest.fn(async () => [{
      name: 'bitcoin',
      status: 'ACTIVE',
      postTypes: ['LINK', 'DISCUSSION', 'BOUNTY', 'POLL']
    }])
  },
  user: {
    findUnique: jest.fn()
  }
}

const schemaArgs = { models, me: { name: 'alice' } }

const validPostFields = {
  title: 'Crypto.com stadium hosts big game',
  text: '',
  subNames: ['bitcoin']
}

const postSchemaCases = [
  ['discussion', discussionSchema(schemaArgs), validPostFields],
  ['link', linkSchema(schemaArgs), { ...validPostFields, url: 'https://example.com/story' }],
  ['bounty', bountySchema(schemaArgs), { ...validPostFields, bounty: 1000 }],
  ['poll', pollSchema({ ...schemaArgs }), {
    ...validPostFields,
    options: ['yes', 'no'],
    pollExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
  }],
  ['job', jobSchema(schemaArgs), {
    title: 'Crypto.com stadium hosts big game',
    company: 'Example Inc',
    text: 'Build useful things',
    url: 'jobs@example.com',
    location: 'New York',
    remote: false
  }]
]

describe('post title validation', () => {
  test.each(postSchemaCases)('%s rejects URLs with URI schemes in titles', async (_, schema, fields) => {
    await expect(schema.validate({
      ...fields,
      title: 'Read this https://example.com/story'
    })).rejects.toThrow('must not contain URLs with URI schemes')
  })

  test.each(postSchemaCases)('%s allows bare domains in titles', async (_, schema, fields) => {
    await expect(schema.validate(fields)).resolves.toEqual(expect.objectContaining({
      title: 'Crypto.com stadium hosts big game'
    }))
  })
})
