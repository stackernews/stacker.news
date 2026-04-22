/* eslint-env jest */

import { maxFeeSatsFromEstimate, sparkConfigPatches, waitForPreimage } from './spark'

const IDENTITY_PUBKEY = `02${'11'.repeat(32)}`
const GENERATED_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('spark client protocol', () => {
  it('creates send-side config patches from a mnemonic and identity', () => {
    expect(
      sparkConfigPatches(
        { mnemonic: GENERATED_MNEMONIC, identityPubkey: IDENTITY_PUBKEY },
        { name: 'SPARK', send: true }
      )
    ).toEqual({
      current: { mnemonic: GENERATED_MNEMONIC },
      complementary: { identityPubkey: IDENTITY_PUBKEY }
    })
  })

  it('creates receive-side config patches from a mnemonic and identity', () => {
    expect(
      sparkConfigPatches(
        { mnemonic: GENERATED_MNEMONIC, identityPubkey: IDENTITY_PUBKEY },
        { name: 'SPARK', send: false }
      )
    ).toEqual({
      current: { identityPubkey: IDENTITY_PUBKEY },
      complementary: { mnemonic: GENERATED_MNEMONIC }
    })
  })

  it('adds a small fee buffer to Spark fee estimates', () => {
    expect(maxFeeSatsFromEstimate(4)).toBe(9)
    expect(maxFeeSatsFromEstimate(0)).toBe(5)
    expect(maxFeeSatsFromEstimate(42.7)).toBe(48)
  })

  it('rejects unexpected fee-estimate shapes instead of silently capping at buffer', () => {
    // Guards against SDK contract drift where a minor version returns an object or non-number.
    // Without this guard, Number({feeSats: 42}) is NaN and maxFeeSats silently becomes 5 sats.
    expect(() => maxFeeSatsFromEstimate({ feeSats: 42 })).toThrow(/must be a non-negative number/)
    expect(() => maxFeeSatsFromEstimate(NaN)).toThrow(/must be a non-negative number/)
    expect(() => maxFeeSatsFromEstimate(null)).toThrow(/must be a non-negative number/)
    expect(() => maxFeeSatsFromEstimate(undefined)).toThrow(/must be a non-negative number/)
    expect(() => maxFeeSatsFromEstimate('4')).toThrow(/must be a non-negative number/)
    expect(() => maxFeeSatsFromEstimate(-1)).toThrow(/must be a non-negative number/)
  })

  it('polls for the preimage when Spark settles asynchronously', async () => {
    const getLightningSendRequest = jest.fn()
      .mockResolvedValueOnce({ status: 'PENDING' })
      .mockResolvedValueOnce({ paymentPreimage: 'preimage-123', status: 'PREIMAGE_PROVIDED' })

    await expect(
      waitForPreimage({ getLightningSendRequest }, 'send-request-1')
    ).resolves.toBe('preimage-123')

    expect(getLightningSendRequest).toHaveBeenCalledTimes(2)
  })

  it('fails fast on Spark failure statuses while polling', async () => {
    const getLightningSendRequest = jest.fn()
      .mockResolvedValueOnce({ status: 'LIGHTNING_PAYMENT_FAILED' })

    await expect(
      waitForPreimage({ getLightningSendRequest }, 'send-request-1')
    ).rejects.toThrow('Spark payment failed (LIGHTNING_PAYMENT_FAILED)')
  })

  it('keeps polling when Spark reports a final status before the preimage is populated', async () => {
    // The SDK sometimes reports LIGHTNING_PAYMENT_SUCCEEDED a tick before paymentPreimage
    // shows up on the send request. Earlier code treated this as a terminal error.
    const getLightningSendRequest = jest.fn()
      .mockResolvedValueOnce({ status: 'LIGHTNING_PAYMENT_SUCCEEDED', paymentPreimage: null })
      .mockResolvedValueOnce({ status: 'LIGHTNING_PAYMENT_SUCCEEDED', paymentPreimage: 'late-preimage' })

    await expect(
      waitForPreimage({ getLightningSendRequest }, 'send-request-1')
    ).resolves.toBe('late-preimage')

    expect(getLightningSendRequest).toHaveBeenCalledTimes(2)
  })

  it('propagates abort on in-flight polls', async () => {
    const controller = new AbortController()
    const getLightningSendRequest = jest.fn().mockResolvedValue({ status: 'PENDING' })

    const promise = waitForPreimage({ getLightningSendRequest }, 'send-request-1', { signal: controller.signal })
    controller.abort(new Error('timeout'))

    await expect(promise).rejects.toThrow('timeout')
  })
})
