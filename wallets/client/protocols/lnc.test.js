/* eslint-env jest */

import { sendPayment, testSendPayment } from '@/wallets/client/protocols/lnc'
import { isAbortLike } from '@/lib/time'
import { WalletPaymentRejectedError, WalletPermissionsError } from '@/wallets/client/errors'

// the adapter only runs in the browser and keeps its connection singleton on window
beforeAll(() => {
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis
})

const SEND_PERM = 'routerrpc.Router.SendPaymentV2'
const REMOVED_SEND_PERM = 'lnrpc.Lightning.SendPaymentSync'
const CREDS = { pairingPhrase: 'abandon ability able about' }
const signal = () => new AbortController().signal

// The adapter keeps a connection singleton on window, so tests swap the instance it
// finds there. sendPaymentV2 resolves the first stream update (like trackPaymentV2),
// which is the only one sent when noInflightUpdates is set.
function useFakeLnc ({ perms = [SEND_PERM], onSend } = {}) {
  const requests = []
  window.snLnc = {
    isConnected: true,
    credentials: { credentials: {} },
    hasPerms: perm => perms.includes(perm),
    connect: async () => {},
    disconnect () { this.isConnected = false },
    lnd: {
      router: {
        sendPaymentV2 (request, onMessage, onError) {
          requests.push(request)
          if (onSend) onSend(request, onMessage, onError)
        }
      }
    }
  }
  return requests
}

beforeEach(() => {
  // same credentials as the singleton remembers, so no reconnect is attempted
  window.snLncCredentials = { ...CREDS }
})

afterEach(() => {
  // the adapter arms its idle-disconnect timer on window; leaving it armed keeps
  // jest alive for its duration after the run
  clearTimeout(window.snLncKillerTimeout)
})

describe('lnc sendPayment', () => {
  it('caps the fee with fee_limit_sat and asks for the terminal update only', async () => {
    const requests = useFakeLnc({
      onSend: (request, onMessage) => onMessage({ status: 2, feeMsat: '1000' })
    })

    const result = await sendPayment('lnbc1invoice', CREDS, { maxFee: 10, signal: signal() })

    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      paymentRequest: 'lnbc1invoice',
      feeLimitSat: '10',
      noInflightUpdates: true
    })
    // the SendPaymentSync feeLimit oneof no longer exists on routerrpc
    expect(requests[0].feeLimit).toBeUndefined()
    expect(result.status).toBe('SETTLED')
  })

  it('reports a settled payment with the preimage in hex', async () => {
    const preimage = 'ab'.repeat(32)
    useFakeLnc({
      onSend: (request, onMessage) => onMessage({
        status: 2,
        paymentPreimage: Buffer.from(preimage, 'hex').toString('base64'),
        feeMsat: '2000'
      })
    })

    const result = await sendPayment('lnbc1', CREDS, { maxFee: 5, signal: signal() })

    expect(result.status).toBe('SETTLED')
    expect(result.preimage).toBe(preimage)
    expect(result.actualFeeMsats).toBeDefined()
  })

  it('treats a settled payment without proof as settled, not as a failure', async () => {
    useFakeLnc({ onSend: (request, onMessage) => onMessage({ status: 2, feeSat: '3' }) })

    const result = await sendPayment('lnbc1', CREDS, { maxFee: 5, signal: signal() })

    expect(result).toEqual({ status: 'SETTLED', actualFeeMsats: expect.anything() })
    expect(result.preimage).toBeUndefined()
  })

  it('throws a rejected-payment error on a terminal failure', async () => {
    useFakeLnc({
      onSend: (request, onMessage) => onMessage({ status: 3, failureReason: 'FAILURE_REASON_NO_ROUTE' })
    })

    await expect(sendPayment('lnbc1', CREDS, { maxFee: 5, signal: signal() }))
      .rejects.toThrow(WalletPaymentRejectedError)
    await expect(sendPayment('lnbc1', CREDS, { maxFee: 5, signal: signal() }))
      .rejects.toThrow(/FAILURE_REASON_NO_ROUTE/)
  })

  it('stays ambiguous when a failure carries no reason', async () => {
    useFakeLnc({
      onSend: (request, onMessage) => onMessage({ status: 3, failureReason: 'FAILURE_REASON_NONE' })
    })

    const result = await sendPayment('lnbc1', CREDS, { maxFee: 5, signal: signal() })

    expect(result.status).toBe('UNKNOWN')
  })

  it('stays ambiguous on an in-flight update instead of claiming an outcome', async () => {
    useFakeLnc({ onSend: (request, onMessage) => onMessage({ status: 1 }) })

    const result = await sendPayment('lnbc1', CREDS, { maxFee: 5, signal: signal() })

    expect(result).toEqual({ status: 'UNKNOWN', detail: 'payment still in flight' })
  })

  it('refuses to send from a session that only holds the removed permission', async () => {
    useFakeLnc({ perms: [REMOVED_SEND_PERM] })

    await expect(sendPayment('lnbc1', CREDS, { maxFee: 5, signal: signal() }))
      .rejects.toThrow(WalletPermissionsError)
    await expect(sendPayment('lnbc1', CREDS, { maxFee: 5, signal: signal() }))
      .rejects.toThrow(new RegExp(REMOVED_SEND_PERM.replace(/\./g, '\\.')))
    await expect(sendPayment('lnbc1', CREDS, { maxFee: 5, signal: signal() }))
      .rejects.toThrow(new RegExp(SEND_PERM.replace(/\./g, '\\.')))
  })

  it('names the removed permission when validating a stale session', async () => {
    useFakeLnc({ perms: [REMOVED_SEND_PERM] })

    await expect(testSendPayment(CREDS, { signal: signal() }))
      .rejects.toThrow(WalletPermissionsError)
    await expect(testSendPayment(CREDS, { signal: signal() }))
      .rejects.toThrow(/SendPaymentSync/)
  })

  it('accepts a session that grants the new permission', async () => {
    useFakeLnc({})

    await expect(testSendPayment(CREDS, { signal: signal() })).resolves.toBeDefined()
  })

  it('keeps an abort abort-like instead of turning it into a payment outcome', async () => {
    useFakeLnc({})
    const controller = new AbortController()
    controller.abort()

    const err = await sendPayment('lnbc1', CREDS, { maxFee: 5, signal: controller.signal })
      .then(() => null, e => e)

    expect(err).toBeTruthy()
    expect(isAbortLike(err)).toBe(true)
    expect(err).not.toBeInstanceOf(WalletPaymentRejectedError)
  })

  it('keeps a stream error unmapped so it stays ambiguous', async () => {
    useFakeLnc({ onSend: (request, onMessage, onError) => onError(new Error('transport closed')) })

    const err = await sendPayment('lnbc1', CREDS, { maxFee: 5, signal: signal() })
      .then(() => null, e => e)

    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('transport closed')
    expect(isAbortLike(err)).toBe(false)
  })
})
