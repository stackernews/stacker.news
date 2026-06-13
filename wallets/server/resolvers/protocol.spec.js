/* eslint-env jest */

import { assertMatchingBolt11Networks, bolt11Network } from '@/wallets/server/bolt11-network'

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

describe('assertMatchingBolt11Networks', () => {
  test('accepts invoices on the same network', () => {
    expect(() => assertMatchingBolt11Networks('lnbcrt1wallet', 'lnbcrt1stacker')).not.toThrow()
  })

  test('rejects wallet invoices on a different network than the SN node', () => {
    expect(() => assertMatchingBolt11Networks('lnbc1wallet', 'lnbcrt1stacker'))
      .toThrow('wallet is on mainnet but SN node is on regtest')
  })

  test('rejects invalid wallet invoices', () => {
    expect(() => assertMatchingBolt11Networks('not-an-invoice', 'lnbc1stacker'))
      .toThrow('wallet returned invalid invoice')
  })

  test('rejects invalid SN node invoices', () => {
    expect(() => assertMatchingBolt11Networks('lnbc1wallet', 'not-an-invoice'))
      .toThrow('SN node returned invalid invoice')
  })
})
