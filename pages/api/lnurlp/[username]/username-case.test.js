/* eslint-env jest */

import { createHash } from 'crypto'
import models from '@/api/models'
import assertGofacYourself from '@/api/resolvers/ofac'
import pay from '@/api/payIn'
import { lnurlPayMetadata } from '@/lib/lnurl'
import indexHandler from './index'
import payHandler from './pay'

jest.mock('@/api/models', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('@/api/resolvers/ofac', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('@/wallets/server', () => ({
  __esModule: true,
  walletLogger: jest.fn(() => ({
    info: jest.fn(() => Promise.resolve()),
    error: jest.fn(() => Promise.resolve())
  }))
}))

jest.mock('@/api/payIn', () => ({
  __esModule: true,
  default: jest.fn()
}))

function mockRes () {
  return {
    statusCode: undefined,
    body: undefined,
    status: jest.fn(function (statusCode) {
      this.statusCode = statusCode
      return this
    }),
    json: jest.fn(function (body) {
      this.body = body
      return this
    })
  }
}

describe('lnurlp username casing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_URL = 'https://stacker.news'
    models.user.findUnique.mockResolvedValue({ id: 1, name: 'SwapMarket' })
    assertGofacYourself.mockResolvedValue()
    pay.mockResolvedValue({ payInBolt11: { bolt11: 'lnbc1test', hash: 'testhash' } })
  })

  test('uses the canonical username in metadata and callback urls', async () => {
    const res = mockRes()

    await indexHandler({ query: { username: 'swapmarket' } }, res)

    expect(models.user.findUnique).toHaveBeenCalledWith({ where: { name: 'swapmarket' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.callback).toBe('https://stacker.news/api/lnurlp/SwapMarket/pay')
    expect(res.body.metadata).toBe(lnurlPayMetadata('SwapMarket').metadata)
  })

  test('uses the canonical username when creating pay request hashes', async () => {
    const res = mockRes()
    const expectedMetadata = lnurlPayMetadata('SwapMarket')

    await payHandler({ query: { username: 'swapmarket', amount: '21000' }, headers: {} }, res)

    expect(pay).toHaveBeenCalledWith('PROXY_PAYMENT', expect.objectContaining({
      msats: 21000n,
      description: expectedMetadata.description,
      descriptionHash: expectedMetadata.descriptionHash
    }), expect.objectContaining({
      me: { id: 1, name: 'SwapMarket' }
    }))
    expect(res.statusCode).toBe(200)
    expect(res.body.verify).toBe('https://stacker.news/api/lnurlp/SwapMarket/verify/testhash')
  })

  test('uses the canonical username when hashing payer data', async () => {
    const res = mockRes()
    const payerData = JSON.stringify({ name: 'Alice' })
    const metadata = lnurlPayMetadata('SwapMarket').metadata
    const descriptionHash = createHash('sha256').update(metadata + payerData).digest('hex')

    await payHandler({ query: { username: 'swapmarket', amount: '21000', payerdata: payerData }, headers: {} }, res)

    expect(pay).toHaveBeenCalledWith('PROXY_PAYMENT', expect.objectContaining({
      descriptionHash,
      lud18Data: { name: 'Alice' }
    }), expect.objectContaining({
      me: { id: 1, name: 'SwapMarket' }
    }))
    expect(res.statusCode).toBe(200)
  })
})
