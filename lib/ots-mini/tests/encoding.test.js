/* eslint-env jest */

import { SerializeContext, DeserializeContext } from '../encoding.js'
import { MAX_MSG_LENGTH } from '../constants.js'

// ---------------------------------------------------------------------------
// SerializeContext
// ---------------------------------------------------------------------------

describe('SerializeContext overflow protection', () => {
  test('throws when total written bytes exceed MAX_MSG_LENGTH via writeBytes', () => {
    const ctx = new SerializeContext()
    const half = Buffer.alloc(Math.floor(MAX_MSG_LENGTH / 2) + 1, 0)
    ctx.writeBytes(half)
    expect(() => ctx.writeBytes(half)).toThrow()
  })

  test('throws when writeByte pushes total past MAX_MSG_LENGTH', () => {
    const ctx = new SerializeContext()
    ctx.writeBytes(Buffer.alloc(MAX_MSG_LENGTH, 0))
    expect(() => ctx.writeByte(0x00)).toThrow()
  })
})

describe('SerializeContext.writeByte input validation', () => {
  test('rejects negative value', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeByte(-1)).toThrow()
  })

  test('rejects value > 255', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeByte(256)).toThrow()
  })

  test('rejects non-integer value', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeByte(1.5)).toThrow()
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
    expect(() => ctx.writeBytes('hello')).toThrow()
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

  test('encodes MAX_MSG_LENGTH without throwing', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeVaruint(MAX_MSG_LENGTH)).not.toThrow()
  })

  test('throws on value exceeding MAX_MSG_LENGTH', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeVaruint(MAX_MSG_LENGTH + 1)).toThrow()
  })

  test('throws on negative value', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeVaruint(-1)).toThrow()
  })

  test('throws on non-integer', () => {
    const ctx = new SerializeContext()
    expect(() => ctx.writeVaruint(1.5)).toThrow()
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
    expect(() => new DeserializeContext('hello')).toThrow()
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
    expect(() => ctx.readByte()).toThrow()
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
    expect(() => ctx.readBytes(3)).toThrow()
  })
})

describe('DeserializeContext.readVaruint', () => {
  test('decodes 0x00 as 0', () => {
    const ctx = new DeserializeContext(Buffer.from([0x00]))
    expect(ctx.readVaruint()).toBe(0)
  })

  test('decodes 0x01 as 1', () => {
    const ctx = new DeserializeContext(Buffer.from([0x01]))
    expect(ctx.readVaruint()).toBe(1)
  })

  test('decodes 0x7f as 127', () => {
    const ctx = new DeserializeContext(Buffer.from([0x7f]))
    expect(ctx.readVaruint()).toBe(127)
  })

  test('decodes [0x80, 0x01] as 128', () => {
    const ctx = new DeserializeContext(Buffer.from([0x80, 0x01]))
    expect(ctx.readVaruint()).toBe(128)
  })

  test('throws on too many iterations (all continuation bytes)', () => {
    // 9 bytes all with high bit set — exceeds MAX_VARUINT_ITERS (8)
    const buf = Buffer.alloc(9, 0x80)
    const ctx = new DeserializeContext(buf)
    expect(() => ctx.readVaruint()).toThrow(/iterations/)
  })

  test('throws when decoded value exceeds MAX_MSG_LENGTH', () => {
    // Encode a value larger than MAX_MSG_LENGTH (4096) in LEB128
    // 4097 = 0b1_0000_0000_0001 → [0x81, 0xa0, 0x00] wait let me compute properly
    // Actually, let's just craft bytes for a huge value
    // 0x80 0x80 0x80 0x01 = 1 << 21 = 2097152 which exceeds MAX_MSG_LENGTH
    const ctx = new DeserializeContext(Buffer.from([0x80, 0x80, 0x80, 0x01]))
    expect(() => ctx.readVaruint()).toThrow(/exceeds/)
  })
})

describe('DeserializeContext.readVarbytes', () => {
  test('reads length-prefixed bytes', () => {
    const ctx = new DeserializeContext(Buffer.from([0x03, 0xaa, 0xbb, 0xcc]))
    expect(ctx.readVarbytes()).toEqual(Buffer.from([0xaa, 0xbb, 0xcc]))
  })

  test('reads zero-length varbytes', () => {
    const ctx = new DeserializeContext(Buffer.from([0x00]))
    expect(ctx.readVarbytes()).toEqual(Buffer.alloc(0))
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
    expect(() => ctx.peek(1)).toThrow()
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
    expect(() => ctx.skip(0)).toThrow()
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
    expect(() => ctx.assertMagic('hello')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Round-trip: writeVaruint → readVaruint
// ---------------------------------------------------------------------------
describe('writeVaruint / readVaruint round-trip', () => {
  const edgeValues = [0, 1, 127, 128, 255, 256, 1000, MAX_MSG_LENGTH]

  for (const n of edgeValues) {
    test(`round-trips value ${n}`, () => {
      const sctx = new SerializeContext()
      sctx.writeVaruint(n)
      const dctx = new DeserializeContext(sctx.getOutput())
      expect(dctx.readVaruint()).toBe(n)
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
    expect(dctx.readVarbytes()).toEqual(data)
  })

  test('round-trips empty buffer', () => {
    const sctx = new SerializeContext()
    sctx.writeVarbytes(Buffer.alloc(0))
    const dctx = new DeserializeContext(sctx.getOutput())
    expect(dctx.readVarbytes()).toEqual(Buffer.alloc(0))
  })
})
