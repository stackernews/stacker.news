/* eslint-env jest */

import {
  assertBolt11MatchesChains,
  bolt11Network,
  bolt11NetworkForChains
} from './bolt11'

const CHAINS = {
  mainnet: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
  testnet: '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943',
  testnet4: '00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
  signet: '00000008819873e925422c1ff0f99f7cc9bbb232af63a077a480a3633bee1ef6',
  regtest: '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206'
}

describe('bolt11 networks', () => {
  it('detects bitcoin networks from BOLT11 prefixes', () => {
    expect(bolt11Network('lnbc1pvalidish')?.name).toBe('bitcoin mainnet')
    expect(bolt11Network('lntb1pvalidish')?.name).toBe('bitcoin testnet')
    expect(bolt11Network('lntbs1pvalidish')?.name).toBe('bitcoin signet')
    expect(bolt11Network('lnbcrt1pvalidish')?.name).toBe('bitcoin regtest')
  })

  it('unwraps lightning-prefixed invoices before detecting the network', () => {
    expect(bolt11Network('lightning:lnbcrt1pvalidish')?.name).toBe('bitcoin regtest')
    expect(bolt11Network('bitcoin:bcrt1qexample?lightning=lnbcrt1pvalidish')?.name).toBe('bitcoin regtest')
  })

  it('maps ln-service wallet chains to BOLT11 networks', () => {
    expect(bolt11NetworkForChains([CHAINS.mainnet])?.name).toBe('bitcoin mainnet')
    expect(bolt11NetworkForChains([CHAINS.testnet])?.name).toBe('bitcoin testnet')
    expect(bolt11NetworkForChains([CHAINS.testnet4])?.name).toBe('bitcoin testnet')
    expect(bolt11NetworkForChains([CHAINS.signet])?.name).toBe('bitcoin signet')
    expect(bolt11NetworkForChains([CHAINS.regtest])?.name).toBe('bitcoin regtest')
  })

  it('accepts invoices for the local wallet chain', () => {
    expect(() => assertBolt11MatchesChains('lnbc1pvalidish', [CHAINS.mainnet])).not.toThrow()
    expect(() => assertBolt11MatchesChains('lnbcrt1pvalidish', [CHAINS.regtest])).not.toThrow()
  })

  it('rejects invoices for a different bitcoin network', () => {
    expect(() => assertBolt11MatchesChains('lnbc1pvalidish', [CHAINS.regtest]))
      .toThrow('wallet invoice is for bitcoin mainnet, but SN node is on bitcoin regtest')
  })

  it('rejects unknown invoice and chain networks', () => {
    expect(() => assertBolt11MatchesChains('not-an-invoice', [CHAINS.regtest]))
      .toThrow('invalid bolt11 invoice')
    expect(() => assertBolt11MatchesChains('lnbc1pvalidish', ['unknown-chain']))
      .toThrow('unable to determine local bitcoin network')
  })
})
