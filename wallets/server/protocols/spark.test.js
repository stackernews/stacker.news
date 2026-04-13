/* eslint-env jest */

import { sparkCreateLightningInvoiceArgs } from './spark'

const IDENTITY_PUBKEY = `02${'11'.repeat(32)}`
const VALID_DESCRIPTION_HASH = '4'.repeat(64)

describe('sparkCreateLightningInvoiceArgs', () => {
  it('maps SN invoice args to Spark memo invoices', () => {
    expect(
      sparkCreateLightningInvoiceArgs(
        { msats: 1500, description: 'SN test invoice', expiry: 360 },
        { identityPubkey: IDENTITY_PUBKEY }
      )
    ).toEqual({
      amountSats: 1,
      expirySeconds: 360,
      memo: 'SN test invoice',
      receiverIdentityPubkey: IDENTITY_PUBKEY
    })
  })

  it('uses description hashes without adding a memo', () => {
    expect(
      sparkCreateLightningInvoiceArgs(
        { msats: 2000, description: 'ignored', descriptionHash: VALID_DESCRIPTION_HASH, expiry: 90 },
        { identityPubkey: IDENTITY_PUBKEY }
      )
    ).toEqual({
      amountSats: 2,
      descriptionHash: VALID_DESCRIPTION_HASH,
      expirySeconds: 90,
      receiverIdentityPubkey: IDENTITY_PUBKEY
    })
  })

  it('rejects invalid identity pubkeys', () => {
    expect(() => {
      sparkCreateLightningInvoiceArgs(
        { msats: 1000, description: 'SN test invoice', expiry: 1 },
        { identityPubkey: 'invalid' }
      )
    }).toThrow('identity pubkey must be a compressed secp256k1 pubkey')
  })

  it('rejects malformed description hashes', () => {
    expect(() => {
      sparkCreateLightningInvoiceArgs(
        { msats: 1000, description: 'x', descriptionHash: 'notahex', expiry: 1 },
        { identityPubkey: IDENTITY_PUBKEY }
      )
    }).toThrow('description hash must be 64 hex chars')
  })
})
