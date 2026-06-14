/* eslint-env jest */

jest.mock('../../../../api/models', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn()
    }
  }
}))

const handler = require('./index').default
const models = require('../../../../api/models').default

function mockResponse () {
  return {
    status: jest.fn(function (code) {
      this.statusCode = code
      return this
    }),
    json: jest.fn(function (body) {
      this.body = body
      return this
    })
  }
}

describe('lnurlp provider descriptor', () => {
  const env = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...env, NEXT_PUBLIC_URL: 'https://stacker.news' }
  })

  afterAll(() => {
    process.env = env
  })

  test('normalizes lowercased lightning address lookups to the canonical user name', async () => {
    models.user.findUnique.mockResolvedValue({ id: 1, name: 'SwapMarket' })

    const res = mockResponse()
    await handler({ query: { username: 'swapmarket' } }, res)

    expect(models.user.findUnique).toHaveBeenCalledWith({ where: { name: 'swapmarket' } })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.body.callback).toBe('https://stacker.news/api/lnurlp/SwapMarket/pay')
    expect(JSON.parse(res.body.metadata)).toEqual([
      ['text/plain', 'Proxied payment to SwapMarket@stacker.news'],
      ['text/identifier', 'SwapMarket@stacker.news']
    ])
  })
})
