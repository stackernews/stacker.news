import { loadProtocol, protocolNames } from './registry'

export * from './util'

/**
 * @typedef {@import('@/wallets/lib/protocols').ProtocolName} ProtocolName
 */

/**
 * @typedef {Object} ClientWalletProtocol
 * @property {ProtocolName} name - must match a protocol name in the database
 * @property {ProtocolSendPayment} sendPayment - pays a bolt11 invoice
 * @property {ProtocolTestSendPayment} testSendPayment - test if configuration can pay
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

function lazyProtocol (name) {
  return {
    name,
    sendPayment: async (...args) => (await loadProtocol(name)).sendPayment(...args),
    testSendPayment: async (...args) => (await loadProtocol(name)).testSendPayment(...args)
  }
}

/** @type {ClientWalletProtocol[]} */
export default protocolNames.map(lazyProtocol)
