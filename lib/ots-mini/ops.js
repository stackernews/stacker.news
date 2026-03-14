import crypto from 'node:crypto'
import { SerializeContext } from './encoding.js'

/**
 * Abstract base class for timestamp operations (hash, append, prepend).
 */
export class Op {
  /**
   * The single-byte tag identifying this op type. Abstract.
   * @returns {number}
   */
  _TAG () {
    throw new Error(`${this._TAG_NAME()}._TAG is abstract`)
  }

  /**
   * The name of this op type.
   * @returns {string}
   */
  _TAG_NAME () { return 'op' }

  /**
   * Apply this operation to msg. Abstract
   * @param {Buffer} msg
   */
  call (msg) {
    // abstract — subclasses must implement
    throw new Error(`${this._TAG_NAME()}.call is abstract`)
  }

  /**
   * Serialize this op's tag byte into ctx.
   * @param {SerializeContext} ctx
   */
  serialize (ctx) {
    ctx.writeByte(this._TAG())
  }

  /**
   * Return a Buffer that uniquely identifies this op instance. Abstract.
   * @returns {Buffer}
   */
  uniqueId () {
    // abstract, subclasses must implement
    throw new Error(`${this._TAG_NAME()}.uniqueId is abstract`)
  }

  /**
   * Check equality with another Op by comparing uniqueId buffers.
   * @param {Op} other
   * @returns {boolean}
   */
  equals (other) {
    if (!(other instanceof Op)) {
      return false
    }
    return this.uniqueId().equals(other.uniqueId())
  }

  /**
   * Read one tag byte from ctx and return the matching Op instance.
   *
   * Tag dispatch:
   *   0xf0 → OpAppend  (reads varbytes arg)
   *   0xf1 → OpPrepend (reads varbytes arg)
   *   0x08 → new OpSHA256()
   *
   * @param {DeserializeContext} ctx
   * @returns {Op}
   * @throws {Error} when an unknown/unimplemented tag is provided.
   */
  static deserialize (ctx) {
    const tag = ctx.readByte()

    if (tag === OpSHA256.TAG) {
      return new OpSHA256()
    } else if (tag === OpAppend.TAG) {
      return new OpAppend(ctx.readVarbytes())
    } else if (tag === OpPrepend.TAG) {
      return new OpPrepend(ctx.readVarbytes())
    }

    throw new Error(`Op.deserialize: tag 0x${tag.toString(16)} is unimplemented`)
  }
}

/**
 * Base class for unary (no-argument) operations like cryptographic hashes.
 */
export class OpUnary extends Op {
  /**
   * Return a unique identifier based on the tag byte.
   * @returns {Buffer}
   */
  uniqueId () {
    return Buffer.from([this._TAG()])
  }
}

/**
 * Abstract base class for cryptographic hash operations.
 */
export class CryptOp extends OpUnary {
  /**
   * Return the digest length in bytes. Abstract.
   * @returns {number}
   */
  _DIGEST_LENGTH () {
    // abstract
    throw new Error('CryptOp._DIGEST_LENGTH is abstract')
  }

  /**
   * Return the node:crypto algorithm name (e.g. 'sha256'). Abstract.
   * @returns {string}
   */
  _HASHLIB_NAME () {
    // abstract
    throw new Error('CryptOp._HASHLIB_NAME is abstract')
  }

  /**
   * Hash the message using the configured algorithm.
   * @param {Buffer} msg
   * @returns {Buffer}
   */
  call (msg) {
    return crypto.createHash(this._HASHLIB_NAME()).update(msg).digest()
  }
}

/**
 * SHA-256 hash operation.
 */
export class OpSHA256 extends CryptOp {
  /** @type {number} Tag byte identifying SHA-256 ops. */
  static TAG = 0x08
  _TAG () { return OpSHA256.TAG }
  _TAG_NAME () { return 'sha256' }
  _HASHLIB_NAME () { return 'sha256' }
  _DIGEST_LENGTH () { return 32 }
}

/**
 * Base class for binary operations that take an argument buffer (append, prepend).
 */
export class OpBinary extends Op {
  /**
   * @param {Buffer} arg - The byte argument for this binary op.
   * @throws {Error} If arg is not a Buffer.
   */
  constructor (arg) {
    super()
    if (!Buffer.isBuffer(arg)) {
      throw new Error('OpBinary: arg must be a Buffer')
    }
    this.arg = Buffer.from(arg)
  }

  /**
   * Serialize the tag byte followed by the varbytes-encoded argument.
   * @param {SerializeContext} ctx
   */
  serialize (ctx) {
    ctx.writeByte(this._TAG())
    ctx.writeVarbytes(this.arg)
  }

  /**
   * Return a unique identifier based on the serialized form (tag + arg).
   * @returns {Buffer}
   */
  uniqueId () {
    const ctx = new SerializeContext()
    this.serialize(ctx)
    return ctx.getOutput()
  }
}

/**
 * Append operation: concatenates arg after the message.
 */
export class OpAppend extends OpBinary {
  /** @type {number} Tag byte identifying append ops. */
  static TAG = 0xf0
  _TAG () { return OpAppend.TAG }
  _TAG_NAME () { return 'append' }

  /**
   * Append this.arg to msg.
   * @param {Buffer} msg
   * @returns {Buffer}
   */
  call (msg) {
    return Buffer.concat([msg, this.arg])
  }
}

/**
 * Prepend operation: concatenates arg before the message.
 */
export class OpPrepend extends OpBinary {
  /** @type {number} Tag byte identifying prepend ops. */
  static TAG = 0xf1
  _TAG () { return OpPrepend.TAG }
  _TAG_NAME () { return 'prepend' }

  /**
   * Prepend this.arg to msg.
   * @param {Buffer} msg
   * @returns {Buffer}
   */
  call (msg) {
    return Buffer.concat([this.arg, msg])
  }
}
