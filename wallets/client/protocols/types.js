/**
 * Protocol names as used in the database
 * @typedef {'NWC'|'LNBITS'|'PHOENIXD'|'BLINK'|'WEBLN'|'LN_ADDR'|'LNC'|'CLN_REST'|'LND_GRPC'} ProtocolName
 * @typedef {'text'|'password'} InputType
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
 */

/**
 * @typedef {Object} Protocol
 * @property {ProtocolName} name - must match a protocol name in the database
 * @property {string} displayName - protocol name in user interface
 * @property {boolean} send - is this protocol is for sending payments?
 * @property {ProtocolField[]} fields - protocol fields for configuration
 * @property {yup.Schema} schema - yup schema for validation of fields
 */
