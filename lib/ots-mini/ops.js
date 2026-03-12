import crypto from 'node:crypto'
import { SerializeContext } from './encoding.js'

export class Op {
  _TAG () {
    throw new Error(`${this._TAG_NAME()}._TAG is abstract`)
  }

  _TAG_NAME () { return 'op' }

  /** Apply this operation to msg and return the resulting Uint8Array. */
  call (msg) {
    // abstract — subclasses must implement
    throw new Error(`${this._TAG_NAME()}.call is abstract`)
  }

  serialize (ctx) {
    ctx.writeByte(this._TAG())
  }

  // returns a Buffer
  uniqueId () {
    // abstract, subclasses must implement
    throw new Error(`${this._TAG_NAME()}.uniqueId is abstract`)
  }

  equals (other) {
    if (!(other instanceof Op)) {
      return false
    }
    return this.uniqueId().equals(other.uniqueId())
  }

  /**
   * Read one tag byte from ctx and return the matching Op instance.
   * Tag dispatch:
   *   0xf0 → OpAppend  (reads varbytes arg)
   *   0xf1 → OpPrepend (reads varbytes arg)
   *   0x08 → new OpSHA256()
   * Throws on unknown tag.
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

export class OpUnary extends Op {
  uniqueId () {
    return Buffer.from([this._TAG()])
  }
}

export class CryptOp extends OpUnary {
  _DIGEST_LENGTH () {
    // abstract
    throw new Error('CryptOp._DIGEST_LENGTH is abstract')
  }

  _HASHLIB_NAME () {
    // abstract — return a node:crypto algorithm string, e.g. 'sha256'
    throw new Error('CryptOp._HASHLIB_NAME is abstract')
  }

  call (msg) {
    return crypto.createHash(this._HASHLIB_NAME()).update(msg).digest()
  }
}

export class OpSHA256 extends CryptOp {
  static TAG = 0x08
  _TAG () { return OpSHA256.TAG }
  _TAG_NAME () { return 'sha256' }
  _HASHLIB_NAME () { return 'sha256' }
  _DIGEST_LENGTH () { return 32 }
}

export class OpBinary extends Op {
  constructor (arg) {
    super()
    if (!Buffer.isBuffer(arg)) {
      throw new Error('OpBinary: arg must be a Buffer')
    }
    this.arg = Buffer.from(arg)
  }

  serialize (ctx) {
    ctx.writeByte(this._TAG())
    ctx.writeVarbytes(this.arg)
  }

  // OpBinary uniqueness is defined by its serialized form
  uniqueId () {
    const ctx = new SerializeContext()
    this.serialize(ctx)
    return ctx.getOutput()
  }
}

export class OpAppend extends OpBinary {
  static TAG = 0xf0
  _TAG () { return OpAppend.TAG }
  _TAG_NAME () { return 'append' }

  call (msg) {
    return Buffer.concat([msg, this.arg])
  }
}

export class OpPrepend extends OpBinary {
  static TAG = 0xf1
  _TAG () { return OpPrepend.TAG }
  _TAG_NAME () { return 'prepend' }

  call (msg) {
    return Buffer.concat([this.arg, msg])
  }
}
