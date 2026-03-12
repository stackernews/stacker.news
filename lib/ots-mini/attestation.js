import { MAX_ATTESTATION_PAYLOAD_SIZE, MAX_ATTESTATION_URI_SIZE } from './constants.js'
import { SerializeContext } from './encoding.js'

/**
 * Abstract base class for timestamp attestations.
 */
export class Attestation {
  /**
   * Return the 8-byte tag identifying this attestation type. Abstract.
   * @returns {Buffer}
   */
  _TAG () {
    // abstract
    throw new Error('Attestation._TAG is abstract')
  }

  /**
   * Compare this attestation to another for ordering. Abstract.
   * @param {Attestation} other
   * @returns {number} Negative, zero, or positive integer.
   */
  compare (other) {
    // abstract
    throw new Error('Attestation.compareTo is abstract')
  }

  /**
   * Check equality with another attestation.
   * @param {Attestation} other
   * @returns {boolean}
   */
  equals (other) {
    return this.compare(other) === 0
  }

  /**
   * Serialize this attestation into the given context. Abstract.
   * @param {SerializeContext} ctx
   */
  serialize (ctx) {
    // abstract
    throw new Error('Attestation.serialize is abstract')
  }

  /**
   * Read 8-byte tag from ctx; dispatch to the right subclass deserializer.
   * @param {DeserializeContext} ctx
   * @returns {Attestation}
   */
  static deserialize (ctx) {
    const tag = ctx.readBytes(8)
    if (tag.equals(Buffer.from(PendingAttestation.TAG))) {
      return PendingAttestation.deserialize(ctx)
    } else {
      throw new Error(`Attestation.deserialize: unimplemented tag: ${tag.toString('hex')}`)
    }
  }
}

/**
 * Attestation indicating a timestamp is pending confirmation by a calendar server.
 */
export class PendingAttestation extends Attestation {
  /** @type {Buffer} 8-byte tag identifying pending attestations. */
  static TAG = Buffer.from([0x83, 0xdf, 0xe3, 0x0d, 0x2e, 0xf9, 0x0c, 0x8e])

  /**
   * Return the 8-byte tag for pending attestations.
   * @returns {Buffer}
   */
  _TAG () {
    return PendingAttestation.TAG
  }

  /**
   * @param {string} uri - Calendar server URI.
   * @throws {Error} If uri is not a valid uri
   */
  constructor (uri) {
    super()
    if (typeof uri !== 'string' || uri.length === 0) {
      throw new Error('PendingAttestation: uri must be a non-empty string')
    }
    PendingAttestation.validateUri(uri)
    this.uri = uri // string
  }

  /**
   * Validate that a URI contains only allowed characters.
   * @param {string} uri
   * @throws {Error} If uri contains illegal characters.
   */
  static validateUri (uri) {
    const regex = /[^-:_.\\/A-Za-z0123456789]/g
    const illegalChars = Array.from(uri.matchAll(regex))
    if (illegalChars.length) {
      const illegalCharsMapping = illegalChars.map(m => `${m} at :${m.index}`).join(',')
      throw new Error(
        `PendingAttestation.validateUri: uri contains illegal character(s) ${illegalCharsMapping}`)
    }
  }

  /**
   * Compare this attestation to another by tag then URI.
   * @param {Attestation} other
   * @returns {number}
   * @throws {Error} If other is not an Attestation.
   */
  compare (other) {
    if (!(other instanceof Attestation)) {
      throw new Error('PendingAttestation.compare: other must be an Attestation')
    }
    const tagcmp = this._TAG().compare(other._TAG())
    if (tagcmp !== 0) {
      return tagcmp
    }
    return Buffer.from(this.uri, 'utf-8').compare(Buffer.from(other.uri, 'utf-8'))
  }

  /**
   * Serialize this pending attestation (tag + payload) into ctx.
   * @param {SerializeContext} ctx
   */
  serialize (ctx) {
    ctx.writeBytes(PendingAttestation.TAG)

    // serialize the payload separately
    const payloadSerializer = new SerializeContext()
    payloadSerializer.writeVarbytes(Buffer.from(this.uri, 'utf-8'))

    ctx.writeVarbytes(payloadSerializer.getOutput())
  }

  /**
   * Decode a URI from a raw byte payload using UTF-8.
   * @param {Buffer|Uint8Array} payload
   * @returns {string} The decoded URI.
   * @throws {Error} If payload is not valid UTF-8.
   */
  static decodeUri (payload) {
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let uri
    try {
      uri = decoder.decode(payload)
    } catch (e) {
      throw new Error(`PendingAttestation.decodeUri: uri is not valid UTF-8: ${e.message}`, e)
    }
    return uri
  }

  /**
   * Deserialize a PendingAttestation from ctx (after the tag has been read).
   * @param {DeserializeContext} ctx
   * @returns {PendingAttestation}
   * @throws {Error} If payload or inner uri bytes exceed their maxima
   */
  static deserialize (ctx) {
    const payloadSize = ctx.readVaruint(MAX_ATTESTATION_PAYLOAD_SIZE)

    // since PendingAttestation must only have a single uri in payload, the
    // next uint must, including its own bytesize, be exactly payloadSize
    const uriSize = ctx.readVaruint(payloadSize, payloadSize, true)

    if (uriSize > MAX_ATTESTATION_URI_SIZE) {
      throw new Error(`PendingAttestation.deserialize: uri exceeds ${MAX_ATTESTATION_URI_SIZE} bytes`)
    }

    const payload = ctx.readBytes(uriSize)
    const uri = PendingAttestation.decodeUri(payload)
    return new PendingAttestation(uri)
  }
}
