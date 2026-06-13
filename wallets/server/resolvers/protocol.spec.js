/* eslint-env jest */

import {
  assertWalletInvoiceNetwork,
  bolt11Network,
  bolt11NetworkForName,
  stackerBolt11Network
} from '@/wallets/server/bolt11-network'

describe('bolt11Network', () => {
  test.each([
    ['lnbc1example', 'mainnet'],
    ['LNBC1EXAMPLE', 'mainnet'],
    ['lntb1example', 'testnet'],
    ['lntbs1example', 'signet'],
    ['lnbcrt1example', 'regtest']
  ])('detects %s as %s', (invoice, networkName) => {
    expect(bolt11Network(invoice)).toEqual(expect.objectContaining({ name: networkName }))
  })

  test.each([null, '', 'bitcoin:abc', 'lnurl1example'])('returns null for invalid invoice %p', invoice => {
    expect(bolt11Network(invoice)).toBeNull()
  })
})

describe('bolt11NetworkForName', () => {
  test.each([
    ['mainnet', 'mainnet'],
    ['bc', 'mainnet'],
    ['LNBC', 'mainnet'],
    ['testnet', 'testnet'],
    ['tb', 'testnet'],
    ['signet', 'signet'],
    ['tbs', 'signet'],
    ['regtest', 'regtest'],
    ['bcrt', 'regtest']
  ])('normalizes %s to %s', (networkName, expectedName) => {
    expect(bolt11NetworkForName(networkName)).toEqual(expect.objectContaining({ name: expectedName }))
  })

  test('returns null for unknown networks', () => {
    expect(bolt11NetworkForName('liquid')).toBeNull()
  })
})

describe('stackerBolt11Network', () => {
  test('uses LNCLI_NETWORK when configured', () => {
    expect(stackerBolt11Network({ NODE_ENV: 'production', LNCLI_NETWORK: 'regtest' }))
      .toEqual(expect.objectContaining({ name: 'regtest' }))
  })

  test('uses LIGHTNING_NETWORK when LNCLI_NETWORK is absent', () => {
    expect(stackerBolt11Network({ NODE_ENV: 'production', LIGHTNING_NETWORK: 'signet' }))
      .toEqual(expect.objectContaining({ name: 'signet' }))
  })

  test('uses BITCOIN_NETWORK when other network vars are absent', () => {
    expect(stackerBolt11Network({ NODE_ENV: 'production', BITCOIN_NETWORK: 'testnet' }))
      .toEqual(expect.objectContaining({ name: 'testnet' }))
  })

  test('defaults development to regtest', () => {
    expect(stackerBolt11Network({ NODE_ENV: 'development' }))
      .toEqual(expect.objectContaining({ name: 'regtest' }))
  })

  test('defaults non-development envs to mainnet', () => {
    expect(stackerBolt11Network({ NODE_ENV: 'production' }))
      .toEqual(expect.objectContaining({ name: 'mainnet' }))
  })
})

describe('assertWalletInvoiceNetwork', () => {
  test('accepts invoices on the same network', () => {
    expect(() => assertWalletInvoiceNetwork('lnbcrt1wallet', bolt11NetworkForName('regtest'))).not.toThrow()
  })

  test('rejects wallet invoices on a different network than the SN node', () => {
    expect(() => assertWalletInvoiceNetwork('lnbc1wallet', bolt11NetworkForName('regtest')))
      .toThrow('wallet is on mainnet but SN node is on regtest')
  })

  test('rejects invalid wallet invoices', () => {
    expect(() => assertWalletInvoiceNetwork('not-an-invoice', bolt11NetworkForName('mainnet')))
      .toThrow('wallet returned invalid invoice')
  })

  test('rejects invalid SN node network config', () => {
    expect(() => assertWalletInvoiceNetwork('lnbc1wallet', null))
      .toThrow('SN node network is invalid')
  })
})
