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

// Mock LND functions to return valid test data
jest.mock('ln-service', () => ({
  __esModule: true,
  getWalletInfo: jest.fn((params, callback) => {
    // Call callback with mock wallet info
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
  parsePaymentRequest: jest.fn((params) => ({
    id: params.request?.split('lnbc')[1]?.slice(0, 10) || 'mock_id',
    tokens: 1000,
    mtokens: '1000000',
    destination: 'mock_destination',
    description: 'mock_description',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    cltv_delta: 40
  })),
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
    console.error('❌ DATABASE_URL not set!')
    console.error('   Make sure docker-compose is running and .env.development is loaded.')
    console.error('   Next.js should automatically load .env.development')
    throw new Error('DATABASE_URL required for tests')
  }

  // Log test environment
  console.error('✓ Test environment configured')
  console.error(`  Node: ${process.version}`)
  console.error(`  Database: ${process.env.DATABASE_URL.split('@')[1]?.split('?')[0] || 'configured'}`)
})
