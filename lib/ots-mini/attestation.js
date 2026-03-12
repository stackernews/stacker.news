import { SerializeContext } from './encoding.js'

export class Attestation {
  _TAG () {
    // abstract
    throw new Error('Attestation._TAG is abstract')
  }

  compare (other) {
    // abstract
    throw new Error('Attestation.compareTo is abstract')
  }

  equals (other) {
    return this.compare(other) === 0
  }

  serialize (ctx) {
    // abstract
    throw new Error('Attestation.serialize is abstract')
  }

  /**
   * Read 8-byte tag from ctx; dispatch to the right subclass deserializer.
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

export class PendingAttestation extends Attestation {
  static TAG = Buffer.from([0x83, 0xdf, 0xe3, 0x0d, 0x2e, 0xf9, 0x0c, 0x8e])
  static MAX_PAYLOAD_SIZE = 1000

  _TAG () {
    return PendingAttestation.TAG
  }

  constructor (uri) {
    super()
    if (typeof uri !== 'string' || uri.length === 0) {
      throw new Error('PendingAttestation: uri must be a non-empty string')
    }
    PendingAttestation.validateUri(uri)
    this.uri = uri // string
  }

  static validateUri (uri) {
    const regex = /[^-:_\\.\\/A-Za-z0123456789]/g
    const illegalChars = Array.from(uri.matchAll(regex))
    if (illegalChars.length) {
      const illegalCharsMapping = illegalChars.map(m => `${m} at :${m.index}`).join(',')
      throw new Error(
        `PendingAttestation.validateUri: uri contains illegal character(s) ${illegalCharsMapping}`)
    }
  }

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

  serialize (ctx) {
    ctx.writeBytes(PendingAttestation.TAG)

    // serialize the payload separately
    const payloadSerializer = new SerializeContext()
    payloadSerializer.writeVarbytes(Buffer.from(this.uri, 'utf-8'))

    ctx.writeVarbytes(payloadSerializer.getOutput())
  }

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

  static deserialize (ctx) {
    const payloadSize = ctx.readVaruint()
    if (payloadSize > PendingAttestation.MAX_PAYLOAD_SIZE) {
      throw new Error(`PendingAttestation.deserialize: rejecting payload larger than ${PendingAttestation.MAX_PAYLOAD_SIZE} bytes`)
    }
    const payload = ctx.readVarbytes()
    const uri = PendingAttestation.decodeUri(payload)
    return new PendingAttestation(uri)
  }
}
