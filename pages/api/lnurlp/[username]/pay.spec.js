/* eslint-env jest */

jest.mock('../../../../api/models', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('../../../../api/payIn', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('../../../../api/resolvers/ofac', () => ({
  __esModule: true,
  default: jest.fn()
}))

const logger = {
  info: jest.fn(() => Promise.resolve()),
  error: jest.fn(() => Promise.resolve())
}

jest.mock('../../../../wallets/server', () => ({
  walletLogger: jest.fn(() => logger)
}))

const handler = require('./pay').default
const models = require('../../../../api/models').default
const pay = require('../../../../api/payIn').default
const assertGofacYourself = require('../../../../api/resolvers/ofac').default
const { lnurlPayMetadata } = require('../../../../lib/lnurl')
const { createHash } = require('crypto')

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

describe('lnurlp pay callback', () => {
  const env = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...env, NEXT_PUBLIC_URL: 'https://stacker.news' }
    models.user.findUnique.mockResolvedValue({ id: 1, name: 'SwapMarket' })
    assertGofacYourself.mockResolvedValue()
    pay.mockResolvedValue({
      payInBolt11: {
        bolt11: 'lnbc210n1example',
        hash: 'payment-hash'
      }
    })
  })

  afterAll(() => {
    process.env = env
  })

  test('uses the canonical user name when a wallet lowercases the callback path', async () => {
    const res = mockResponse()
    await handler({ query: { username: 'swapmarket', amount: '21000' }, headers: {} }, res)

    const { description, descriptionHash } = lnurlPayMetadata('SwapMarket')
    expect(pay).toHaveBeenCalledWith('PROXY_PAYMENT', expect.objectContaining({
      msats: 21000n,
      description,
      descriptionHash
    }), { models, me: { id: 1, name: 'SwapMarket' } })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.body.verify).toBe('https://stacker.news/api/lnurlp/SwapMarket/verify/payment-hash')
  })

  test('hashes payer data against canonical metadata for lowercased callback paths', async () => {
    const payerdata = JSON.stringify({ name: 'Alice' })
    const res = mockResponse()
    await handler({ query: { username: 'swapmarket', amount: '21000', payerdata }, headers: {} }, res)

    const { metadata } = lnurlPayMetadata('SwapMarket')
    expect(pay).toHaveBeenCalledWith('PROXY_PAYMENT', expect.objectContaining({
      descriptionHash: createHash('sha256').update(metadata + payerdata).digest('hex'),
      lud18Data: { name: 'Alice' }
    }), { models, me: { id: 1, name: 'SwapMarket' } })
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
