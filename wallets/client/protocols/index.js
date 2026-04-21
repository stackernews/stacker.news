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
 */

/**
 * @callback ProtocolSendPayment
 * @param {SendPaymentArgs} args - arguments for the payment
 * @param {Object} config - current protocol configuration
 * @param {SendPaymentOptions} opts - additional options for the payment
 * @returns {Promise<Preimage>} - preimage
 */

/**
 * @typedef {Object} SendPaymentArgs
 * @property {number} bolt11 - the bolt11 invoice the wallet should pay
 */

/**
 * @typedef {Object} SendPaymentOptions
 * @property {AbortSignal} signal - signal to abort the request
 */

/**
 * @callback ProtocolTestSendPayment
 * @param {Object} config - current protocol configuration
 * @param {SendPaymentOptions} opts - additional options for the payment
 * @returns {Promise<void>}
 */

/**
 * @callback ProtocolGetBalance
 * @param {Object} config - current protocol configuration
 * @param {SendPaymentOptions} opts - additional options for the request
 * @returns {Promise<ProtocolBalance|null|undefined>}
 */

/**
 * @typedef {Object} ProtocolBalance
 * @property {number} amount - sats for BTC balances, cents for fiat balances
 * @property {string} currency - BTC or ISO currency code
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
