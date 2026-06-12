import * as nwc from './nwc'
import * as lnbits from './lnbits'
import * as phoenixd from './phoenixd'
import * as blink from './blink'
import * as webln from './webln'
import * as lnc from './lnc'
import * as clnRest from './clnRest'
import * as clink from './clink'

export * from './util'

/**
 * @typedef {@import('@/wallets/lib/protocols').ProtocolName} ProtocolName
 */

/**
 * @typedef {Object} ClientWalletProtocol
 * @property {ProtocolName} name - must match a protocol name in the database
 * @property {ProtocolSendPayment} sendPayment - pays a bolt11 invoice
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
 * @returns {Promise<Preimage>} - preimage
 */

/**
 * @typedef {Object} ProtocolRequestOptions
 * @property {AbortSignal} signal - required cancellation signal; adapters must
 *   reject promptly when it aborts, including during SDK calls and polling loops.
 *   Abort/timeout rejections must remain detectable by `isAbortLike(err)`.
 * @property {number} [maxFee] - maximum fee in sats
 * @property {number} [timeout] - maximum time in milliseconds for SDKs that
 *   need their own deadline; do not use this instead of respecting `signal`
 */

/**
 * Adapter abort contract:
 * - use `raceAbort` around SDK promises that do not accept `signal`
 * - use `abortableSleep` inside polling loops
 * - never wrap an abort-like error in `WalletPaymentRejectedError` or a
 *   validation/configuration class: a timeout proves nothing about the payment
 *   outcome, and those classes would render it as a definitive, safe-to-retry
 *   failure. `pollUntilSettled` also relies on abort-likeness to stop polling.
 */

/**
 * Adapter failure-classification contract:
 * "This payment definitively failed" is the claim that needs proof. Unless an
 * adapter proves it, `sendWalletPayment` classifies an error as settled-unknown
 * and the direct-send shell warns "may still be in flight" instead of inviting
 * a retry that double-pays. To prove a failure is safe to retry:
 * - throw `WalletPaymentRejectedError` exactly where the provider itself
 *   reports the payment terminally failed (an error response, a FAILED status,
 *   a terminal `{ error }` from `pollUntilSettled`'s classify)
 * - throw `WalletValidationError`/`WalletConfigurationError` (or subclasses)
 *   for problems that occur before any payment is attempted
 * Everything else — transport errors, SDK throws, aborts/timeouts — is treated
 * as settled-unknown automatically; never convert one into a definitive failure.
 * Return a missing/undefined preimage on an unprovable settlement (e.g.
 * intra-ledger) so `sendWalletPayment`'s proof check surfaces it.
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
  clink
]
