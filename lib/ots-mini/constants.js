// --------------------------------------
// PROTOCOL CONSTANTS
// --------------------------------------

/** @type {Buffer} 31-byte magic header identifying OpenTimestamps proof files. */
export const HEADER_MAGIC = Buffer.from([
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73,
  0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94
])

/** @type {number} Major version of the OTS proof format. */
export const MAJOR_VERSION = 1

// --------------------------------------
// LIMITS
// --------------------------------------

/** @type {number} The maximum size of the entire payload for an Attestation */
export const MAX_ATTESTATION_PAYLOAD_SIZE = 8192

/** @type {number} Maximum allowed PendingAttestation uri size in bytes. */
export const MAX_ATTESTATION_URI_SIZE = 1000

/** @type {number} Maximum number of attestations allowed per timestamp node. */
export const MAX_ATTESTATIONS_PER_TIMESTAMP = 16

/** @type {number} Overall maximum length in bytes for all Timestamp.msg */
export const MAX_TIMESTAMP_MSG_LENGTH = 4096

/** @type {number} Maximum nodes in a Timestamp tree */
// Value taken from python opentimestamps/core/timestamp.py
export const TIMESTAMP_RECURSION_LIMIT = 256

/** @type {number} Maximum serialized item length in bytes. */
// Note:
// - this corresponds to a 2-byte encoded varuint ([0xff, 0x7f])
// - this must be larger than any other limit
export const MAX_ITEM_LENGTH = 16383

/** @type {number} Maximum number of iterations for reading a VarUInt */
// Note: As this is purely to prevent padding attacks, we're keeping this
// at the serialized varuint size of MAX_ITEM_LENGTH + 1
export const MAX_VARUINT_BYTES = 3

/** @type {number} The maximum number of bytes a remote calendar is allowed to send us **/
export const MAX_RESPONSE_SIZE = 10000

// --------------------------------------
// CALENDAR DEFAULTS
// --------------------------------------

/** @type {string[]} Default public calendar server URLs. */
export const DEFAULT_CALENDARS = [
  'https://a.pool.opentimestamps.org',
  'https://b.pool.opentimestamps.org',
  'https://a.pool.eternitywall.com',
  'https://ots.btc.catallaxy.com'
]

/** @type {number} Default milliseconds window for remote calendar timeouts */
export const DEFAULT_REMOTE_TIMEOUT = 30 * 1000

/** @type {number} Minimum number of successful calendar responses required. */
export const MIN_CALENDAR_RESPONSES = 1
