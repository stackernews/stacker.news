/* eslint-env jest */

/**
 * Jest Setup for PayIn Tests
 *
 * This file configures the test environment to work with the existing
 * docker-compose setup. It assumes:
 * - docker-compose is running
 * - .env.development is loaded by Next.js (automatic)
 * - Database is available on the configured port
 *
 * Run tests with: npm test -- --config api/payIn/__tests__/jest.config.js
 */

// Mock packages that cause ES module errors
// These must be at the top level (jest.mock is hoisted)

jest.mock('@cashu/cashu-ts', () => ({
  __esModule: true,
  CashuMint: jest.fn(),
  CashuWallet: jest.fn(),
  getEncodedToken: jest.fn(),
  getDecodedToken: jest.fn()
}))

jest.mock('@shocknet/clink-sdk', () => ({
  __esModule: true,
  default: jest.fn()
}))

// Counter for guaranteed unique invoice hashes
let invoiceCounter = 0
let hodlCounter = 0

// Mock LND functions to return valid test data
// Even with LND in docker-compose, mocking is cleaner for tests
jest.mock('ln-service', () => ({
  __esModule: true,
  getWalletInfo: jest.fn((params, callback) => {
    if (callback) {
      callback(null, {
        public_key: 'mock_pubkey',
        alias: 'test_node'
      })
    }
    return Promise.resolve({
      public_key: 'mock_pubkey',
      alias: 'test_node'
    })
  }),
  // Mock createInvoice to return valid invoice for optimistic flow
  createInvoice: jest.fn((params) => {
    /* eslint-disable camelcase */
    const { mtokens, description, expires_at } = params
    // Use counter + timestamp + random for guaranteed uniqueness
    invoiceCounter++
    const hash = `invoice_${invoiceCounter}_${Date.now()}_${Math.random()}_${process.hrtime.bigint()}`
    const secret = `secret_${invoiceCounter}_${Date.now()}_${Math.random()}`
    return Promise.resolve({
      id: hash,
      request: `lnbc${mtokens}test${hash}`,
      secret,
      mtokens: String(mtokens), // Ensure it's a string
      description,
      expires_at
    })
    /* eslint-enable camelcase */
  }),
  // Mock createHodlInvoice for pessimistic flow
  createHodlInvoice: jest.fn((params) => {
    /* eslint-disable camelcase */
    const { mtokens, description, expires_at } = params
    // Use counter + timestamp + random for guaranteed uniqueness
    hodlCounter++
    const hash = `hodl_${hodlCounter}_${Date.now()}_${Math.random()}_${process.hrtime.bigint()}`
    const secret = `secret_${hodlCounter}_${Date.now()}_${Math.random()}`
    return Promise.resolve({
      id: hash,
      request: `lnbc${mtokens}hodl${hash}`,
      secret,
      mtokens: String(mtokens), // Ensure it's a string
      description,
      expires_at
    })
    /* eslint-enable camelcase */
  }),
  parsePaymentRequest: jest.fn((params) => {
    const request = params.request || ''

    // Try real parser first (for actual bolt11s from lnbits)
    if (request.startsWith('lnbcrt') || request.startsWith('lnbc1')) {
      try {
        const actualParse = jest.requireActual('ln-service').parsePaymentRequest
        return actualParse(params)
      } catch (e) {
        // If real parser fails, fall through to mock
      }
    }

    // Handle our mocked test invoices
    // Extract mtokens from our test format: lnbc{mtokens}test{hash}
    const mtokensMatch = request.match(/lnbc(\d+)/)
    const mtokens = mtokensMatch ? mtokensMatch[1] : '1000000'

    // Extract the unique hash we generated (everything after 'test' or 'hodl' or 'lnbits')
    const hashMatch = request.match(/(?:test|hodl|lnbits)(.+)$/)
    const uniqueHash = hashMatch ? hashMatch[1] : `fallback_${Date.now()}_${Math.random()}`

    return {
      id: uniqueHash,
      tokens: Number(BigInt(mtokens) / 1000n),
      mtokens,
      destination: 'mock_destination',
      description: 'mock_description',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      cltv_delta: 40
    }
  }),
  payViaPaymentRequest: jest.fn().mockResolvedValue({
    id: 'mock_payment_id',
    is_confirmed: true
  }),
  getInvoice: jest.fn().mockResolvedValue({
    is_confirmed: false,
    is_held: false,
    is_canceled: false,
    received_mtokens: '0'
  }),
  getIdentity: jest.fn().mockResolvedValue({
    public_key: '02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    alias: 'test_node'
  }),
  getBlockHeight: jest.fn().mockResolvedValue({
    current_block_height: 800000
  }),
  subscribeToInvoice: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function * () {
      // Mock subscription - just yield confirmed
      yield { is_confirmed: true }
    }
  }),
  cancelHodlInvoice: jest.fn().mockResolvedValue({}),
  settleHodlInvoice: jest.fn().mockResolvedValue({}),
  getPayment: jest.fn().mockResolvedValue({
    is_confirmed: false,
    is_failed: false
  })
}))

// Mock pg-boss to prevent job queue operations during tests
jest.mock('pg-boss', () => {
  return jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
    start: jest.fn().mockResolvedValue({}),
    stop: jest.fn().mockResolvedValue({})
  }))
})

// Note: Can't easily mock api/lnd without breaking other imports
// Invoice wrapping requires actual LND connection which we don't have from host machine

// Mock cross-fetch but allow real lnbits calls
jest.mock('cross-fetch', () => {
  const actualFetch = jest.requireActual('cross-fetch')
  return jest.fn((url, options) => {
    // Allow real lnbits API calls (127.0.0.1:5001)
    if (url && url.includes('127.0.0.1:5001') && url.includes('/api/v1/payments')) {
      return actualFetch(url, options)
    }

    // Mock other lnbits API calls (for invoice creation without wallet)
    if (url && url.includes('lnbits') && url.includes('/api/v1/payments')) {
      // Parse request body to get amount
      let msats = '1000000'
      if (options && options.body) {
        try {
          const body = JSON.parse(options.body)
          msats = String(BigInt(body.amount || 1000) * 1000n)
        } catch (e) {}
      }

      const hash = `lnbits_${Date.now()}_${Math.random()}_${process.hrtime.bigint()}`
      return Promise.resolve({
        ok: true,
        headers: {
          get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
        },
        json: () => Promise.resolve({
          payment_hash: hash,
          payment_request: `lnbc${msats}lnbits${hash}`
        })
      })
    }

    // For all other URLs, use actual fetch
    return actualFetch(url, options)
  })
})

// Suppress noisy console output during tests
global.console = {
  ...console,
  log: jest.fn(), // Suppress logs
  group: jest.fn(), // Suppress groups
  groupEnd: jest.fn(), // Suppress groups
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn
}

// Environment check
beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL required for tests')
  }
})
