import * as nwc from './nwc'
import * as lnbits from './lnbits'
import * as phoenixd from './phoenixd'
import * as blink from './blink'
import * as webln from './webln'
import * as lnc from './lnc'
import * as clnRest from './clnRest'
import * as clink from './clink'
import * as spark from './spark'

export * from './util'

/**
 * @typedef {@import('@/wallets/lib/protocols').ProtocolName} ProtocolName
 * @typedef {@import('@/wallets/lib/protocols').WalletSettledAt} WalletSettledAt
 */

/**
 * @typedef {Object} ClientWalletProtocol
 * @property {ProtocolName} name - must match a protocol name in the database
 * @property {ProtocolSendPayment} sendPayment - pays a bolt11 invoice
 * @property {ProtocolCheckPayment} [checkPayment] - checks a submitted payment without resending it
 * @property {ProtocolTestSendPayment} testSendPayment - test if configuration can pay
 * @property {ProtocolGetBalance} [getBalance] - fetches wallet balance when supported
 * @property {boolean} enforcesMaxFee - true if the wallet/server hard-caps routing
 *   fees at the user-supplied max; false if the protocol has no per-payment fee cap
 */

/**
 * @callback ProtocolSendPayment
 * @param {string} bolt11 - the bolt11 invoice the wallet should pay
 * @param {Object} config - current protocol configuration
 * @param {ProtocolRequestOptions} opts - additional options for the payment
 * @returns {Promise<{status: 'PENDING'|'SETTLED'|'FAILED'|'UNKNOWN', preimage?: Preimage, actualFeeMsats?: bigint|string, settledAt?: WalletSettledAt, detail?: string}>} - explicit provider payment result
 */

/**
 * @callback ProtocolCheckPayment
 * @param {{hash: string}} payment - payment identity for provider lookup
 * @param {Object} config - current protocol configuration
 * @param {ProtocolRequestOptions} opts - additional options for the lookup
 * @returns {Promise<{status: 'PENDING'|'SETTLED'|'FAILED'|'UNKNOWN', preimage?: string, actualFeeMsats?: bigint|string, settledAt?: WalletSettledAt, detail?: string, errorType?: string}|null>}
 */

/**
 * @typedef {Object} ProtocolRequestOptions
 * @property {AbortSignal} signal - required cancellation signal; adapters must
 *   reject promptly when it aborts, including during SDK calls.
 *   Abort/timeout rejections must remain detectable by `isAbortLike(err)`.
 * @property {number} [maxFee] - maximum fee in sats
 * @property {number} [timeout] - maximum time in milliseconds for SDKs that
 *   need their own deadline; do not use this instead of respecting `signal`
 */

/**
 * Adapter abort contract:
 * - use `raceAbort` around SDK promises that do not accept `signal`
 * - never wrap an abort-like error in `WalletPaymentRejectedError` or a
 *   validation/configuration class: a timeout proves nothing about the payment
 *   outcome, and those classes would render it as a definitive, safe-to-retry failure.
 */

/**
 * Adapter failure-classification contract:
 * "This payment definitively failed" is the claim that needs proof. Unless an
 * adapter proves it, `classifyWalletPaymentError` treats send errors as UNKNOWN
 * and the transaction page warns the payment "may still complete" instead of
 * inviting a retry that double-pays. To prove a failure is safe to retry:
 * - throw `WalletPaymentRejectedError` exactly where the provider itself
 *   reports the payment terminally failed, or return an explicit FAILED result
 * - throw `WalletValidationError`/`WalletConfigurationError` (or subclasses)
 *   for problems that occur before any payment is attempted
 * Everything else — transport errors, SDK throws, aborts/timeouts — remains
 * UNKNOWN automatically; never convert one into a definitive failure.
 *
 * Adapter settlement contract:
 * - a fulfilled transport/RPC call is not itself settlement; validate the
 *   protocol's expected response shape
 * - return PENDING when the response only acknowledges submission and
 *   checkPayment can resolve it
 * - return UNKNOWN when the response is ambiguous and no checker exists
 * - return SETTLED only when the protocol response semantically reports
 *   settlement; that report is authoritative even without a preimage
 */

/**
 * @callback ProtocolTestSendPayment
 * @param {Object} config - current protocol configuration
 * @param {ProtocolRequestOptions} opts - additional options for the payment
 * @returns {Promise<Object|void>|Object|void} - additional values to persist, if the adapter generates them
 */

/**
 * @callback ProtocolGetBalance
 * @param {Object} config - current protocol configuration
 * @param {ProtocolRequestOptions} opts - additional options for the request
 * @returns {Promise<ProtocolBalance|null|undefined>}
 */

/**
 * @typedef {Object} ProtocolBalance
 * @property {number} amount - sats when currency is BTC; minor units such as cents for fiat balances.
 * @property {string} currency - BTC or ISO currency code. Adapters must normalize provider units
 *   with `walletBalance` or `msatsWalletBalance` before returning a balance.
 */

/** @typedef {string} Preimage */

/** @type {ClientWalletProtocol[]} */
export default [
  nwc,
  lnbits,
  phoenixd,
  blink,
  webln,
  lnc,
  clnRest,
  clink,
  spark
]
