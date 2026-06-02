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
 * - never catch-and-wrap abort-like errors; rethrow them unchanged first
 */

/**
 * Adapter in-flight contract:
 * Once the payment request has been transmitted (POST returned, mutation
 * accepted, RPC sent), the adapter must NOT surface an ambiguous error as a
 * definitive failure, or the direct-send shell invites a double-pay. Honor it by:
 * - polling through `pollUntilSettled` (poll-until-timeout: a transient read
 *   error never becomes a failure, only a provider-reported terminal state does)
 * - returning a missing/undefined preimage on an unprovable settlement, so
 *   `sendWalletPayment` surfaces it as settled-unknown
 * - or, for a non-abort post-submit rejection, flagging it with
 *   `settledUnknown: true` (e.g. `throw Object.assign(err, { settledUnknown: true })`)
 * Pre-submit failures (before the request is sent) stay plain throws — they are
 * safe to retry. Abort/timeout is auto-classified by `sendWalletPayment`.
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
