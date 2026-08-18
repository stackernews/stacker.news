import * as nwc from './nwc'
import * as lnbits from './lnbits'
import * as lnAddr from './lnAddr'
import * as clnRest from './clnRest'
import * as phoenixd from './phoenixd'
import * as blink from './blink'
import * as lndGrpc from './lndGrpc'
import * as clink from './clink'
import * as spark from './spark'

export * from './util'

/**
 * @typedef {import('@/wallets/lib/protocols').ProtocolName} ProtocolName
 * @typedef {import('@/wallets/lib/protocols').WalletSettledAt} WalletSettledAt
 */

/**
 * @typedef {Object} ServerWalletProtocol
 * @property {ProtocolName} name - must match a protocol name in the database
 * @property {ProtocolCreateInvoice} createInvoice - create a new invoice
 * @property {boolean} [supportsDescriptionHash] - can create BOLT11 invoices with a caller-supplied description hash
 * @property {ProtocolCheckInvoice} [checkInvoice] - checks a created invoice without creating another one
 * @property {ProtocolTestCreateInvoice} testCreateInvoice - create a test invoice
 */

/**
 * @callback ProtocolCreateInvoice
 * @param {CreateInvoiceArgs} args - arguments for the invoice
 * @param {Object} config - current protocol configuration
 * @param {CreateInvoiceOptions} opts - additional options for the invoice request
 * @returns {Promise<Bolt11|{bolt11: Bolt11, lnurlVerifyUrl?: string, providerRequestId?: string}>} - bolt11 invoice and optional settlement verification data
 */

/**
 * @callback ProtocolCheckInvoice
 * @param {Object} transaction - stored external wallet transaction details, including its invoice hash
 * @param {Object} config - current protocol configuration
 * @param {CreateInvoiceOptions} opts - additional options for the lookup
 * @returns {Promise<{status: 'PENDING'|'SETTLED'|'FAILED'|'EXPIRED'|'UNKNOWN', preimage?: string, msats?: bigint|string, actualFeeMsats?: bigint|string, settledAt?: WalletSettledAt, detail?: string}>} - msats is the received amount; actualFeeMsats any receiver-side fee
 */

/**
 * @typedef {Object} CreateInvoiceArgs
 * @property {number} msats - payment amount in millisatoshis
 * @property {string} description - payment description
 * @property {string} [descriptionHash] - optional description hash (BOLT11 `h` tag)
 * @property {string} [descriptionHashPreimage] - exact source string whose SHA-256 digest is `descriptionHash`
 * @property {number} expiry - expiry time in seconds
 */

/**
 * @typedef {Object} CreateInvoiceOptions
 * @property {AbortSignal} signal - required cancellation signal; adapters must
 *   reject promptly when it aborts, including during SDK calls and polling loops
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
  lndGrpc,
  clink,
  spark
]
