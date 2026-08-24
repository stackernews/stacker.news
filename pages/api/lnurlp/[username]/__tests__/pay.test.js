/* eslint-env jest */

import handler from '../pay.js'
import models from '@/api/models'
import pay from '@/api/payIn'

jest.mock('@/api/models', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } }
}))
jest.mock('@/api/payIn', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/api/resolvers/ofac', () => ({ __esModule: true, default: jest.fn(() => Promise.resolve()) }))
jest.mock('@/wallets/server', () => ({
  walletLogger: () => ({
    info: jest.fn(() => Promise.resolve()),
    error: jest.fn(() => Promise.resolve())
  })
}))
// keep these transitive deps isolated so the suite runs without DB/LND credentials
jest.mock('@/lib/proxy')
jest.mock('@/api/lnd')

const callHandler = async (query) => {
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) }
  await handler({ query, headers: {} }, res)
  return res
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('lnurlp pay endpoint', () => {
  test('returns error if the user does not exist', async () => {
    models.user.findUnique.mockResolvedValue(null)
    const res = await callHandler({ username: 'swapmarket', amount: '21000' })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      status: 'ERROR',
      reason: 'user @swapmarket does not exist'
    })
    expect(pay).not.toHaveBeenCalled()
  })

  test('passes the requested name through as-is (db citext handles case)', async () => {
    // users.name is a citext column, so looking up 'SwapMarket' finds @swapmarket
    models.user.findUnique.mockResolvedValue(null)
    await callHandler({ username: 'SwapMarket', amount: '21000' })
    expect(models.user.findUnique).toHaveBeenCalledWith({ where: { name: 'SwapMarket' } })
  })

  test('rejects amounts below the proxied payment minimum', async () => {
    models.user.findUnique.mockResolvedValue({ id: 1, name: 'swapmarket' })
    const res = await callHandler({ username: 'swapmarket', amount: '1000' })
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ERROR', reason: expect.stringMatching(/^amount must be >=/) })
    )
    expect(pay).not.toHaveBeenCalled()
  })

  test('reports missing receive wallet distinctly so senders are not mislead', async () => {
    models.user.findUnique.mockResolvedValue({ id: 1, name: 'swapmarket' })
    pay.mockRejectedValue(Object.assign(new Error('no wallet to receive available'), { name: 'NoReceiveWalletError' }))
    const res = await callHandler({ username: 'swapmarket', amount: '21000' })
    expect(pay).toHaveBeenCalledWith('PROXY_PAYMENT', expect.anything(), expect.anything())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      status: 'ERROR',
      reason: 'user @swapmarket cannot receive lightning payments right now'
    })
  })

  test('keeps the generic reason for other invoice errors', async () => {
    models.user.findUnique.mockResolvedValue({ id: 1, name: 'swapmarket' })
    pay.mockRejectedValue(new Error('lnd unavailable'))
    const res = await callHandler({ username: 'swapmarket', amount: '21000' })
    expect(res.json).toHaveBeenCalledWith({
      status: 'ERROR',
      reason: 'could not generate invoice to customer\'s attached wallet'
    })
  })
})
