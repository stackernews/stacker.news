import * as nwc from './nwc'
import * as lnbits from './lnbits'
import * as phoenixd from './phoenixd'
import * as blink from './blink'
import * as webln from './webln'

export * from './util'

/**
 * @typedef {@import('@/wallets/lib/protocols').ProtocolName} ProtocolName
 */

/**
 * @typedef {Object} ClientWalletProtocol
 * @property {ProtocolName} name - must match a protocol name in the database
 * @property {ProtocolCreateInvoice} createInvoice - create a new invoice
 * @property {ProtocolTestCreateInvoice} testCreateInvoice - create a test invoice
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

/** @typedef {string} Preimage */

/** @type {ClientWalletProtocol[]} */
export default [
  nwc,
  lnbits,
  phoenixd,
  blink,
  webln
]
