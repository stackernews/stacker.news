import nwcSuite from './nwc'
import lnAddr from './lnAddr'
import clnRestSuite from './clnRest'
import lndGrpc from './lndGrpc'
import lnc from './lnc'
import lnbitsSuite from './lnbits'
import phoenixdSuite from './phoenixd'
import blinkSuite from './blink'
import webln from './webln'
import clinkSuite from './clink'

/**
 * Protocol names as used in the database
 * @typedef {'NWC'|'LNBITS'|'PHOENIXD'|'BLINK'|'WEBLN'|'LN_ADDR'|'LNC'|'CLN_REST'|'LND_GRPC'|'CLINK'} ProtocolName
 * @typedef {'text'|'password'} InputType
 */

/**
 * @typedef {Object} Protocol
 * @property {ProtocolName} name - must match a protocol name in the database
 * @property {string} displayName - protocol name in user interface
 * @property {string} [logName] - protocol name in logs
 * @property {boolean} send - is this protocol for sending payments?
 * @property {ProtocolField[]} fields - protocol fields for configuration
 * @property {string} relationName - name of the relation in the WalletProtocol prisma model
 */

/**
 * @typedef {Object} ProtocolField
 * @property {string} name - formik name
 * @property {string} label - field label shown in user interface
 * @property {InputType} type - input type (text, password)
 * @property {boolean} required - whether field is required
 * @property {yup.Schema} validate - validation rules to apply
 * @property {string} [placeholder] - placeholder text shown in input field
 * @property {string} [hint] - hint text shown below field
 * @property {boolean} [share] - whether field can be used to prepopulate field of complementary send/receive protocol
 * @property {boolean} [editable] - whether the field is editable after it was saved
 * @property {ProtocolFieldPopulate} [populate] - function to populate the field using values from other protocol forms
 */

/**
 * @callback ProtocolFieldPopulate
 * @param {Object} wallet - the wallet we are configuring
 * @param {Object} formState - the current form state across all protocols
 * @returns {string|null} - the value to populate the field with, or null if no value is available
 */

/** @type {Protocol[]} */
export default [
  ...nwcSuite,
  lnAddr,
  ...clnRestSuite,
  lndGrpc,
  lnc,
  ...phoenixdSuite,
  ...lnbitsSuite,
  ...blinkSuite,
  webln,
  ...clinkSuite
]
