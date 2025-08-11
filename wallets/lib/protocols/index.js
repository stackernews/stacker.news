import nwcSuite from './nwc'
import lnAddr from './lnAddr'
import clnRest from './clnRest'
import lndGrpc from './lndGrpc'
import lnc from './lnc'
import lnbitsSuite from './lnbits'
import phoenixdSuite from './phoenixd'
import blinkSuite from './blink'
import webln from './webln'

/**
 * Protocol names as used in the database
 * @typedef {'NWC'|'LNBITS'|'PHOENIXD'|'BLINK'|'WEBLN'|'LN_ADDR'|'LNC'|'CLN_REST'|'LND_GRPC'} ProtocolName
 * @typedef {'text'|'password'} InputType
 */

/**
 * @typedef {Object} Protocol
 * @property {ProtocolName} name - must match a protocol name in the database
 * @property {string} displayName - protocol name in user interface
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
 */

/** @type {Protocol[]} */
export default [
  ...nwcSuite,
  lnAddr,
  clnRest,
  lndGrpc,
  lnc,
  ...phoenixdSuite,
  ...lnbitsSuite,
  ...blinkSuite,
  webln
]
