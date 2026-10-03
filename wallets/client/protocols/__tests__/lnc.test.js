import { lncPaymentResult, lndPaymentSucceeded, lndPaymentFailed, lndPaymentFeeMsats } from '../lnc'

// LND 0.21 removed lnrpc.Lightning.SendPaymentSync; the LNC send adapter now
// uses the server-streaming routerrpc.Router.SendPaymentV2 (issue #3251).
// These tests pin the terminal Payment mapping the adapter relies on.
describe('lnc send adapter (SendPaymentV2 result mapping)', () => {
  it('maps a SUCCEEDED payment with preimage to SETTLED (hex)', () => {
    const preimage = Buffer.from('ab'.repeat(32), 'hex').toString('base64')
    const r = lncPaymentResult({ status: 2, paymentPreimage: preimage, feeMsat: '2100' })
    expect(r.status).toBe('SETTLED')
    expect(r.preimage).toBe('ab'.repeat(32))
  })

  it('maps a numeric SUCCEEDED without preimage to SETTLED (no proof)', () => {
    const r = lncPaymentResult({ status: 2 })
    expect(r.status).toBe('SETTLED')
    expect(r.preimage).toBeUndefined()
  })

  it('accepts the string status form from lnc-web', () => {
    expect(lndPaymentSucceeded({ status: 'SUCCEEDED' })).toBe(true)
    expect(lndPaymentFailed({ status: 'FAILED' })).toBe(true)
  })

  it('maps a FAILED payment to FAILED with the failure reason', () => {
    const r = lncPaymentResult({ status: 3, failureReason: 'FAILURE_REASON_NO_ROUTE' })
    expect(r.status).toBe('FAILED')
    expect(r.detail).toBe('FAILURE_REASON_NO_ROUTE')
  })

  it('reports a generic reason when FAILED has no meaningful reason', () => {
    expect(lncPaymentResult({ status: 3, failureReason: 'FAILURE_REASON_NONE' }).detail)
      .toBe('lnd reports payment failed')
    expect(lncPaymentResult({ status: 3 }).detail).toBe('lnd reports payment failed')
  })

  it('maps a non-terminal payment to UNKNOWN, not a definitive failure', () => {
    expect(lncPaymentResult({ status: 1 }).status).toBe('UNKNOWN') // IN_FLIGHT
    expect(lncPaymentResult({ status: 0 }).status).toBe('UNKNOWN') // UNKNOWN
  })

  it('reads the fee from feeMsat or falls back to feeSat', () => {
    expect(lndPaymentFeeMsats({ feeMsat: '1500' })).toBe(1500n)
    expect(lndPaymentFeeMsats({ feeSat: '2' })).toBe(2000n)
  })
})
