import { MAX_MSG_LENGTH } from './constants.js'

// The maximum number of iterations in DeserializeContext.readVaruint
const MAX_VARUINT_ITERS = 8

export class SerializeContext {
  constructor () {
    this._bufs = []
    this._size = 0
  }

  addBuf (buf) {
    this._bufs.push(buf)
    this._size += buf.length
  }

  writeByte (value) {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error('SerializeContext.writeByte: expect value to be an integer between 0 and 255')
    }
    if (this._size >= MAX_MSG_LENGTH) {
      throw new Error('SerializeContext.writeByte: output exceeds maximum size')
    }
    this.addBuf(Buffer.from([value]))
  }

  writeBytes (bytes) {
    if (!(bytes instanceof Buffer)) {
      throw new Error('SerializeContext.writeBytes: input must be a Buffer')
    }

    if (this._size + bytes.length > MAX_MSG_LENGTH) {
      throw new Error('SerializeContext.writeBytes: output exceeds maximum size')
    }

    this.addBuf(Buffer.from(bytes))
  }

  /** LEB128 encoding */
  writeVaruint (n) {
    if (n === 0) {
      this.writeByte(0x00)
      return
    }

    if (!Number.isInteger(n) || n < 1) {
      throw new Error('SerializeContext.writeVaruint: n must be a positive integer')
    }

    if (n > MAX_MSG_LENGTH) {
      throw new Error('SerializeContext.writeVaruint: n exceeds maximum message length')
    }

    while (n > 0) {
      let b = n & 0x7f
      if (n > 0x7f) {
        b |= 0x80
      }
      this.writeByte(b)
      n >>>= 7
    }
  }

  writeVarbytes (arr) {
    this.writeVaruint(arr.length)
    this.writeBytes(arr)
  }

  getOutput () {
    return Buffer.concat(this._bufs)
  }
}

export class DeserializeContext {
  constructor (data) {
    if (!(data instanceof Buffer)) {
      throw new Error('DeserializeContext(): expect data to be a Buffer')
    }
    this._data = Buffer.from(data) // always copy
    this._pos = 0
  }

  peek (offset) {
    if (offset === undefined) {
      offset = 0
    }
    if (offset < 0) {
      throw new Error('DeserializeContext.peek: Cannot peek backward')
    }
    if (this._pos + offset >= this._data.length) {
      throw new Error('DeserializeContext.peek: Peeking past end of data')
    }
    return this._data.readUInt8(this._pos + offset)
  }

  skip (offset) {
    if (offset < 1) {
      throw new Error('DeserializeContext.skip: Must skip >=1 bytes')
    }
    if (this._pos + offset > this._data.length) {
      throw new Error('DeserializeContext.skip: Skipping past end of data')
    }
    this._pos += offset
  }

  atEOF () {
    return this._pos === this._data.length
  }

  readByte () {
    if (this._pos >= this._data.length) {
      throw new Error('DeserializeContext.readByte: Read past end of data')
    }
    return this._data.readUInt8(this._pos++)
  }

  readBytes (n) {
    if (this._pos + n > this._data.length) {
      throw new Error('DeserializeContext.readBytes: Read past end of data')
    }

    const ret = this._data.slice(this._pos, this._pos + n)
    this._pos += n
    return ret
  }

  /**
   * Reads a varuint from the buffer according to LEB128.
   * - Is limited to MAX_VARUINT_ITERS reads (this module).
   * - Is limited to return an integer of size MAX_MSG_LENGTH (constants.js).
   */
  readVaruint () {
    let uint = 0
    let shift = 0
    let iters = 0
    let byte

    do {
      if (++iters > MAX_VARUINT_ITERS) {
        throw new Error(`DeserializeContext.readVaruint: read iterations exceeded ${MAX_VARUINT_ITERS}`)
      }
      byte = this.readByte()
      uint |= (byte & 0x7f) << shift
      if (uint > MAX_MSG_LENGTH) {
        throw new Error(`DeserializeContext.readVaruint: uint exceeds ${MAX_MSG_LENGTH}`)
      }
      shift += 7
    } while ((byte & 0x80) === 0x80)

    return uint
  }

  /**
   * Reads a varuint length and then reads the number of bytes according to
   * that length.
   */
  readVarbytes () {
    const length = this.readVaruint()
    return this.readBytes(length)
  }

  assertMagic (expectedMagic) {
    if (!(expectedMagic instanceof Buffer)) {
      throw new Error('DeserializeContext.assertMagic: expecting to compare against a buffer')
    }

    const magic = this.readBytes(expectedMagic.length)

    if (!expectedMagic.equals(magic)) {
      throw new Error('DeserializeContext.assertMagic: magic mismatch')
    }
  }
}
