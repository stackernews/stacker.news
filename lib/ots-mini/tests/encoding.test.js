/* eslint-env jest */

import { SerializeContext, DeserializeContext } from '../encoding.js'
import { MAX_ITEM_LENGTH, MAX_VARUINT_BYTES } from '../constants.js'

// ---------------------------------------------------------------------------
// SerializeContext
// ---------------------------------------------------------------------------

describe('SerializeContext.writeByte input validation', () => {
  test('rejects negative value', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeByte(-1)).toThrow(/an integer between 0 and 255/)
  })

  test('rejects value > 255', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeByte(256)).toThrow(/an integer between 0 and 255/)
  })

  test('rejects non-integer value', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeByte(1.5)).toThrow(/an integer between 0 and 255/)
  })

  test('accepts 0 and 255', () => {
    const ctx = new SerializeContext()
    ctx.writeByte(0)
    ctx.writeByte(255)
    expect(ctx.getOutput()).toEqual(Buffer.from([0x00, 0xff]))
  })
})

describe('SerializeContext.writeBytes input validation', () => {
  test('rejects non-Buffer input', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeBytes('hello')).toThrow(/must be a Buffer/)
  })
})

describe('SerializeContext.writeVaruint', () => {
  test('encodes 0 as a single 0x00 byte', () => {
    const ctx = new SerializeContext()
    ctx.writeVaruint(0)
    expect(ctx.getOutput()).toEqual(Buffer.from([0x00]))
  })

  test('encodes 1 as a single 0x01 byte', () => {
    const ctx = new SerializeContext()
    ctx.writeVaruint(1)
    expect(ctx.getOutput()).toEqual(Buffer.from([0x01]))
  })

  test('encodes 127 as a single 0x7f byte', () => {
    const ctx = new SerializeContext()
    ctx.writeVaruint(127)
    expect(ctx.getOutput()).toEqual(Buffer.from([0x7f]))
  })

  test('encodes 128 as two bytes (0x80, 0x01)', () => {
    const ctx = new SerializeContext()
    ctx.writeVaruint(128)
    expect(ctx.getOutput()).toEqual(Buffer.from([0x80, 0x01]))
  })

  test('encodes MAX_ITEM_LENGTH without throwing', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeVaruint(MAX_ITEM_LENGTH)).not.toThrow()
  })

  test('throws on value exceeding MAX_ITEM_LENGTH', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeVaruint(MAX_ITEM_LENGTH + 1)).toThrow(/number too big/)
  })

  test('throws on negative value', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeVaruint(-1)).toThrow(/must be a positive integer/)
  })

  test('throws on non-integer', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeVaruint(1.5)).toThrow(/must be a positive integer/)
  })
})

describe('SerializeContext.writeVarbytes', () => {
  test('writes length prefix followed by data', () => {
    const ctx = new SerializeContext()
    ctx.writeVarbytes(Buffer.from([0xaa, 0xbb, 0xcc]))
    const out = ctx.getOutput()
    // length=3 encoded as varuint(3)=0x03, then 3 data bytes
    expect(out).toEqual(Buffer.from([0x03, 0xaa, 0xbb, 0xcc]))
  })

  test('writes empty buffer as single length byte 0x00', () => {
    const ctx = new SerializeContext()
    ctx.writeVarbytes(Buffer.alloc(0))
    expect(ctx.getOutput()).toEqual(Buffer.from([0x00]))
  })
})

// ---------------------------------------------------------------------------
// DeserializeContext
// ---------------------------------------------------------------------------

describe('DeserializeContext constructor', () => {
  test('rejects non-Buffer input', () => {
    expect(() => new DeserializeContext('hello')).toThrow(/a Buffer/)
  })
})

describe('DeserializeContext.readByte', () => {
  test('reads bytes sequentially', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01, 0x02, 0x03]))
    expect(ctx.readByte()).toBe(0x01)
    expect(ctx.readByte()).toBe(0x02)
    expect(ctx.readByte()).toBe(0x03)
  })

  test('throws when reading past end of data', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01]))
    ctx.readByte()
    expect(() => ctx.readByte()).toThrow(/end of data/)
  })
})

describe('DeserializeContext.readBytes', () => {
  test('reads exact number of bytes', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01, 0x02, 0x03, 0x04]))
    expect(ctx.readBytes(2)).toEqual(Buffer.from([0x01, 0x02]))
    expect(ctx.readBytes(2)).toEqual(Buffer.from([0x03, 0x04]))
  })

  test('throws when reading past end of data', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01, 0x02]))
    expect(() => ctx.readBytes(3)).toThrow(/end of data/)
  })
})

describe('DeserializeContext.readVaruint', () => {
  test('decodes 0x00 as 0', () => {
    const ctx = new DeserializeContext(Buffer.from([0x00]))
    expect(ctx.readVaruint(0xff)).toBe(0)
  })

  test('decodes 0x01 as 1', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01]))
    expect(ctx.readVaruint(0xff)).toBe(1)
  })

  test('decodes 0x7f as 127', () => {
    const ctx = new DeserializeContext(Buffer.from([0x7f]))
    expect(ctx.readVaruint(0xff)).toBe(127)
  })

  test('decodes [0x80, 0x01] as 128', () => {
    const ctx = new DeserializeContext(Buffer.from([0x80, 0x01]))
    expect(ctx.readVaruint(0xff)).toBe(128)
  })

  test('decodes MAX_ITEM_LENGTH', () => {
    const ctx = new DeserializeContext(Buffer.from([0xff, 0x7f]))
    expect(ctx.readVaruint(MAX_ITEM_LENGTH)).toBe(MAX_ITEM_LENGTH)
  })

  test('throws when exceeding MAX_ITEM_LENGTH', () => {
    const buf = Buffer.from([0x80, 0x80, 0x01])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVaruint(MAX_ITEM_LENGTH * 2)).toThrow(/read value exceeds/)
  })

  test('throws on too many bytes read (all continuation bytes)', () => {
    const buf = Buffer.alloc(MAX_VARUINT_BYTES + 1, 0x80)
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVaruint(MAX_ITEM_LENGTH)).toThrow(/serialized varuint exceeds/)
  })

  test('does not throw on max bytes read (all continuation bytes)', () => {
    const buf = Buffer.from([0x80, 0x80, 0x00])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVaruint(MAX_ITEM_LENGTH)).not.toThrow()
  })

  test('throws when no max is given', () => {
    const buf = Buffer.from([0x00])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVaruint()).toThrow(/max must be/)
  })

  test('throws when min > max', () => {
    const buf = Buffer.from([0x00])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVaruint(0, 1)).toThrow(/min must be/)
  })

  test('throws when the read value > max', () => {
    const buf = Buffer.from([0x02])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVaruint(1)).toThrow(/not in range/)
  })

  test('throws when the read value + own length > max in inclusive mode', () => {
    const buf = Buffer.from([0x01])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVaruint(1, 0, true)).toThrow(/not in range/)
  })

  test('throws when the read value < min', () => {
    const buf = Buffer.from([0x01])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVaruint(3, 2)).toThrow(/not in range/)
  })

  test('throws when the read value + own length < min in inclusive mode', () => {
    const buf = Buffer.from([0x01])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVaruint(3, 3, true)).toThrow(/not in range/)
  })
})

describe('DeserializeContext.readVarbytes', () => {
  test('reads length-prefixed bytes', () => {
    const ctx = new DeserializeContext(Buffer.from([0x03, 0xaa, 0xbb, 0xcc]))
    expect(ctx.readVarbytes(0xff)).toEqual(Buffer.from([0xaa, 0xbb, 0xcc]))
  })

  test('reads zero-length varbytes', () => {
    const ctx = new DeserializeContext(Buffer.from([0x00]))
    expect(ctx.readVarbytes(0xff)).toEqual(Buffer.alloc(0))
  })

  test('throws when no maxLen is given', () => {
    const buf = Buffer.from([0x00])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVarbytes()).toThrow(/max must be/)
  })

  test('throws when minLen > maxLen', () => {
    const buf = Buffer.from([0x00])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVarbytes(0, 1)).toThrow(/min must be/)
  })

  test('throws when the read varuint > maxLen', () => {
    const buf = Buffer.from([0x02, 0x02, 0x02])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVarbytes(1)).toThrow(/not in range/)
  })

  test('throws when the read varuint + varuint length > maxLen in inclusive mode', () => {
    const buf = Buffer.from([0x02, 0x02, 0x02])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVarbytes(2, 0, true)).toThrow(/not in range/)
  })

  test('throws when the read varuint < minLen', () => {
    const buf = Buffer.from([0x01, 0x01])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVarbytes(3, 2)).toThrow(/not in range/)
  })

  test('throws when the read varuint + varuint length < minLen in inclusive mode', () => {
    const buf = Buffer.from([0x01, 0x01])
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVarbytes(3, 3, true)).toThrow(/not in range/)
  })
})

describe('DeserializeContext.peek', () => {
  test('returns byte at current position without advancing', () => {
    const ctx = new DeserializeContext(Buffer.from([0x42, 0x43]))
    expect(ctx.peek()).toBe(0x42)
    expect(ctx.peek()).toBe(0x42) // position unchanged
    expect(ctx.peek(1)).toBe(0x43)
  })

  test('throws when peeking past end of data', () => {
    const ctx = new DeserializeContext(Buffer.from([0x42]))
    expect(() => ctx.peek(1)).toThrow(/end of data/)
  })
})

describe('DeserializeContext.skip', () => {
  test('advances position by given offset', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01, 0x02, 0x03]))
    ctx.skip(2)
    expect(ctx.readByte()).toBe(0x03)
  })

  test('throws when skipping past end of data', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01]))
    expect(() => ctx.skip(2)).toThrow()
  })

  test('throws when offset is less than 1', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01]))
    expect(() => ctx.skip(0)).toThrow(/skip >=1 bytes/)
  })
})

describe('DeserializeContext.atEOF', () => {
  test('returns false when data remains', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01]))
    expect(ctx.atEOF()).toBe(false)
  })

  test('returns true when all data consumed', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01]))
    ctx.readByte()
    expect(ctx.atEOF()).toBe(true)
  })

  test('returns true for empty buffer', () => {
    const ctx = new DeserializeContext(Buffer.alloc(0))
    expect(ctx.atEOF()).toBe(true)
  })
})

describe('DeserializeContext.assertMagic', () => {
  test('passes when bytes match', () => {
    const magic = Buffer.from([0xDE, 0xAD])
    const ctx = new DeserializeContext(Buffer.from([0xDE, 0xAD, 0x00]))
    expect(() => ctx.assertMagic(magic)).not.toThrow()
  })

  test('throws on mismatch', () => {
    const magic = Buffer.from([0xDE, 0xAD])
    const ctx = new DeserializeContext(Buffer.from([0xBE, 0xEF]))
    expect(() => ctx.assertMagic(magic)).toThrow(/magic mismatch/)
  })

  test('rejects non-Buffer argument', () => {
    const ctx = new DeserializeContext(Buffer.from([0x00]))
    expect(() => ctx.assertMagic('hello')).toThrow(/a buffer/)
  })
})

// ---------------------------------------------------------------------------
// Round-trip: writeVaruint → readVaruint
// ---------------------------------------------------------------------------
describe('writeVaruint / readVaruint round-trip', () => {
  const edgeValues = [0, 1, 127, 128, 255, 256, 1000, MAX_ITEM_LENGTH]

  for (const n of edgeValues) {
    test(`round-trips value ${n}`, () => {
      const sctx = new SerializeContext()
      sctx.writeVaruint(n)
      const dctx = new DeserializeContext(sctx.getOutput())
      expect(dctx.readVaruint(MAX_ITEM_LENGTH)).toBe(n)
    })
  }
})

// ---------------------------------------------------------------------------
// Round-trip: writeVarbytes → readVarbytes
// ---------------------------------------------------------------------------
describe('writeVarbytes / readVarbytes round-trip', () => {
  test('round-trips arbitrary bytes', () => {
    const data = Buffer.from([0x01, 0x02, 0xff, 0x00, 0x80])
    const sctx = new SerializeContext()
    sctx.writeVarbytes(data)
    const dctx = new DeserializeContext(sctx.getOutput())
    expect(dctx.readVarbytes(0xff)).toEqual(data)
  })

  test('round-trips empty buffer', () => {
    const sctx = new SerializeContext()
    sctx.writeVarbytes(Buffer.alloc(0))
    const dctx = new DeserializeContext(sctx.getOutput())
    expect(dctx.readVarbytes(0xff)).toEqual(Buffer.alloc(0))
  })
})
