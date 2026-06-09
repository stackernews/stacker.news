/* eslint-env jest */

import { bountySchema, discussionSchema, jobSchema, linkSchema, pollSchema } from './validate.js'

const models = {
  sub: {
    findMany: async ({ where }) => {
      return where.name.in.map(name => ({
        name,
        status: 'ACTIVE',
        postTypes: ['BOUNTY', 'DISCUSSION', 'LINK', 'POLL']
      }))
    }
  }
}

const validPost = {
  title: 'Crypto.com stadium hosts big game',
  text: '',
  subNames: ['bitcoin']
}

const postTitleCases = [
  ['bounty', bountySchema({ models }), { ...validPost, bounty: 1000 }],
  ['discussion', discussionSchema({ models }), validPost],
  ['link', linkSchema({ models }), { ...validPost, url: 'https://example.com' }],
  ['poll', pollSchema({ models }), { ...validPost, options: ['one', 'two'] }],
  ['job', jobSchema({}), {
    title: validPost.title,
    company: 'Stacker News',
    text: 'Help build Stacker News',
    url: 'https://stacker.news',
    location: 'Austin'
  }]
]

describe.each(postTitleCases)('%s title validation', (_, schema, validValues) => {
  test('allows domains without a URI scheme', async () => {
    await expect(schema.validate(validValues)).resolves.toBeDefined()
  })

  test('rejects titles containing a URI scheme', async () => {
    await expect(schema.validate({
      ...validValues,
      title: 'Read https://example.com before posting'
    })).rejects.toMatchObject({
      path: 'title',
      message: "can't contain URI schemes"
    })
  })
})
