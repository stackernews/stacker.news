import { MAX_ITEM_LENGTH, MAX_VARUINT_BYTES } from './constants.js'

/**
 * Accumulates bytes for serializing OTS data structures.
 */
export class SerializeContext {
  /** Create a new empty serialization context. */
  constructor () {
    this._bufs = []
    this._size = 0
  }

  /**
   * Append a buffer to the internal list.
   * @param {Buffer} buf
   */
  addBuf (buf) {
    this._bufs.push(buf)
    this._size += buf.length
  }

  /**
   * Write a single byte to the output.
   * @param {number} value - Integer between 0 and 255.
   * @throws {Error} If value is out of range.
   */
  writeByte (value) {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error('SerializeContext.writeByte: expect value to be an integer between 0 and 255')
    }
    this.addBuf(Buffer.from([value]))
  }

  /**
   * Write multiple bytes to the output.
   * @param {Buffer} bytes
   * @throws {Error} If bytes is not a Buffer.
   */
  writeBytes (bytes) {
    if (!(bytes instanceof Buffer)) {
      throw new Error('SerializeContext.writeBytes: input must be a Buffer')
    }
    this.addBuf(Buffer.from(bytes))
  }

  /**
   * Write a varuint to the output.
   * @param {Number} n
   * @throws {Error} If n is negative or larger than MAX_ITEM_LENGTH, or
   *                 more bytes were needed than MAX_VARUINT_BYTES
   */
  writeVaruint (n) {
    if (n === 0) {
      this.writeByte(0x00)
      return
    }

    if (!Number.isInteger(n) || n < 1) {
      throw new Error('SerializeContext.writeVaruint: n must be a positive integer')
    }

    if (n > MAX_ITEM_LENGTH) {
      throw new Error(`SerializeContext.writeVaruint: number too big, exceeds ${MAX_ITEM_LENGTH}`)
    }

    let iters = 0

    while (n > 0) {
      if (iters > MAX_VARUINT_BYTES) {
        throw new Error(`SerializeContext.writeVaruint: serialization required more than ${MAX_VARUINT_BYTES} bytes`)
      }
      let b = n & 0x7f
      if (n > 0x7f) {
        b |= 0x80
      }
      this.writeByte(b)
      n >>>= 7
      iters += 1
    }
  }

  /**
   * Write a length-prefixed byte array (varuint length + raw bytes).
   * @param {Buffer} arr
   */
  writeVarbytes (arr) {
    this.writeVaruint(arr.length)
    this.writeBytes(arr)
  }

  /**
   * Concatenate all accumulated buffers and return the result.
   * @returns {Buffer}
   */
  getOutput () {
    return Buffer.concat(this._bufs)
  }
}

/**
 * Reads bytes sequentially from a buffer for deserializing OTS data structures.
 */
export class DeserializeContext {
  /**
   * @param {Buffer} data - The raw bytes to read from.
   * @throws {Error} If data is not a Buffer.
   */
  constructor (data) {
    if (!(data instanceof Buffer)) {
      throw new Error('DeserializeContext(): expect data to be a Buffer')
    }
    this._data = Buffer.from(data) // always copy
    this._pos = 0
  }

  /**
   * Read a byte at the current position plus offset without advancing.
   * @param {number} [offset=0] - Non-negative offset from current position.
   * @returns {number} The byte value.
   * @throws {Error} If peeking past end of data.
   */
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

  /**
   * Advance the read position by offset bytes.
   * @param {number} offset - Number of bytes to skip (must be >= 1).
   * @throws {Error} If skipping past end of data.
   */
  skip (offset) {
    if (offset < 1) {
      throw new Error('DeserializeContext.skip: Must skip >=1 bytes')
    }
    if (this._pos + offset > this._data.length) {
      throw new Error('DeserializeContext.skip: Skipping past end of data')
    }
    this._pos += offset
  }

  /**
   * Check whether the read position has reached the end of the buffer.
   * @returns {boolean}
   */
  atEOF () {
    return this._pos === this._data.length
  }

  /**
   * Read a single byte and advance the position.
   * @returns {number}
   * @throws {Error} If reading past end of data.
   */
  readByte () {
    if (this._pos >= this._data.length) {
      throw new Error('DeserializeContext.readByte: Read past end of data')
    }
    return this._data.readUInt8(this._pos++)
  }

  /**
   * Read n bytes and advance the position.
   * @param {number} n - Number of bytes to read.
   * @returns {Buffer}
   * @throws {Error} If reading past end of data.
   */
  readBytes (n) {
    if (this._pos + n > this._data.length) {
      throw new Error('DeserializeContext.readBytes: Read past end of data')
    }

    const ret = this._data.slice(this._pos, this._pos + n)
    this._pos += n
    return Buffer.from(ret)
  }

  /**
   * Reads a varuint from the buffer according to LEB128.
   * - Is limited to MAX_VARUINT_BYTES reads
   * - Is limited to return an integer of size MAX_ITEM_LENGTH
   * - Is further limited to a range between min-max, optionally including the number
   *   of bytes read.
   * @param {number} max Mandatory. The maximum value that must be read
   * @param {number} min Optional. The minimum value that must be read (default: 0).
   * @param {boolean} includeSelf Optional. Whether to include the number of bytes read
   *                              for self in the min/max calculation (default: false).
   * @throws {Error} when max or min are misconfigured, the number is greater than
   *                 MAX_VARUINT_BYTES, or the min or max constraints are exceeded
   */
  readVaruint (max = -1, min = 0, includeSelf = false) {
    if (max < 0) {
      throw new Error('DeserializeContext.readVaruint: max must be >= 0')
    }

    if (min > max) {
      throw new Error('DeserializeContext.readVaruint: min must be < max')
    }

    let uint = 0
    let shift = 0
    let iters = 0 // kept separate for clarity
    let byte

    do {
      if (++iters > MAX_VARUINT_BYTES) {
        throw new Error(`DeserializeContext.readVaruint: serialized varuint exceeds ${MAX_VARUINT_BYTES} bytes`)
      }

      byte = this.readByte()
      uint |= (byte & 0x7f) << shift
      if (uint > MAX_ITEM_LENGTH) {
        throw new Error(`DeserializeContext.readVaruint: read value exceeds ${MAX_ITEM_LENGTH}`)
      }

      if ((includeSelf ? uint + iters : uint) > max) {
        throw new Error(`DeserializeContext.readVaruint: read value ${uint} not in range ${min}-${max}`)
      }
      shift += 7
    } while ((byte & 0x80) === 0x80)

    if ((includeSelf ? uint + iters : uint) < min) {
      throw new Error(`DeserializeContext.readVaruint: read value ${uint} not in range ${min}-${max}`)
    }

    return uint
  }

  /**
   * Reads a varuint length and then reads the number of bytes according to
   * that length.
   * @param {number} maxLen Mandatory. The maximum length that must be returned by readVaruint.
   * @param {number} minLen Optional. The minimum length that must be returned by readVaruint (default: 0).
   * @param {boolean} includeUint Optional. Whether to include the byte size of the uint itself in the
   *                              calculation (default: false).
   */
  readVarbytes (maxLen = -1, minLen = 0, includeUint = false) {
    const length = this.readVaruint(maxLen, minLen, includeUint)
    return this.readBytes(length)
  }

  /**
   * Read bytes and assert they match the expected magic header.
   * @param {Buffer} expectedMagic - The expected magic bytes.
   * @throws {Error} If the bytes do not match.
   */
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
