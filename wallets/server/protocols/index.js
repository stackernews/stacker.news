import * as nwc from './nwc'
import * as lnbits from './lnbits'
import * as lnAddr from './lnAddr'
import * as clnRest from './clnRest'
import * as phoenixd from './phoenixd'
import * as blink from './blink'
import * as lndGrpc from './lndGrpc'

export * from './util'

/**
 * @typedef {@import('@/wallets/lib/protocols').ProtocolName} ProtocolName
 */

/**
 * @typedef {Object} ServerWalletProtocol
 * @property {ProtocolName} name - must match a protocol name in the database
 * @property {ProtocolCreateInvoice} createInvoice - create a new invoice
 * @property {ProtocolTestCreateInvoice} testCreateInvoice - create a test invoice
 */

/**
 * @callback ProtocolCreateInvoice
 * @param {CreateInvoiceArgs} args - arguments for the invoice
 * @param {Object} config - current protocol configuration
 * @param {CreateInvoiceOptions} opts - additional options for the invoice request
 * @returns {Promise<Bolt11>} - bolt11 invoice
 */

/**
 * @typedef {Object} CreateInvoiceArgs
 * @property {number} msats - payment amount in millisatoshis
 * @property {string} description - payment description
 * @property {number} expiry - expiry time in seconds
 */

/**
 * @typedef {Object} CreateInvoiceOptions
 * @property {AbortSignal} signal - signal to abort the request
 */

/**
 * @callback ProtocolTestCreateInvoice
 * @param {Object} config - current protocol configuration
 * @param {CreateInvoiceOptions} opts - additional options for the invoice request
 * @returns {Promise<Bolt11>} - bolt11 invoice
 */

/** @typedef {string} Bolt11 */

/** @type {ServerWalletProtocol[]} */
export default [
  nwc,
  lnbits,
  lnAddr,
  clnRest,
  phoenixd,
  blink,
  lndGrpc
]
