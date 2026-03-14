/* eslint-env jest */

import { Op, OpAppend, OpPrepend, OpSHA256 } from '../ops.js'
import { SerializeContext, DeserializeContext } from '../encoding.js'

// ---------------------------------------------------------------------------
// OpSHA256.call()
// ---------------------------------------------------------------------------
describe('OpSHA256.call()', () => {
  test('SHA256 of empty buffer matches known vector', () => {
    const result = new OpSHA256().call(Buffer.from(''))
    expect(result.toString('hex')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  test('SHA256 of "abc" matches known vector', () => {
    const result = new OpSHA256().call(Buffer.from('abc'))
    expect(result.toString('hex')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

// ---------------------------------------------------------------------------
// OpAppend.call()
// ---------------------------------------------------------------------------
describe('OpAppend.call()', () => {
  test('appends arg bytes after msg bytes', () => {
    const result = new OpAppend(Buffer.from([0x00])).call(Buffer.from([0x11]))
    expect(result.toString('hex')).toBe('1100')
  })
})

// ---------------------------------------------------------------------------
// OpPrepend.call()
// ---------------------------------------------------------------------------
describe('OpPrepend.call()', () => {
  test('prepends arg bytes before msg bytes', () => {
    const result = new OpPrepend(Buffer.from([0x00])).call(Buffer.from([0x11]))
    expect(result.toString('hex')).toBe('0011')
  })
})

// ---------------------------------------------------------------------------
// OpBinary constructor validation
// ---------------------------------------------------------------------------
describe('OpBinary constructor validation', () => {
  test('throws on non-Buffer arg', () => {
    expect(() => new OpAppend('hello')).toThrow(/must be a Buffer/)
  })

  test('throws on number arg', () => {
    expect(() => new OpAppend(42)).toThrow(/must be a Buffer/)
  })

  test('throws on array arg', () => {
    expect(() => new OpAppend([0x00])).toThrow(/must be a Buffer/)
  })
})

// ---------------------------------------------------------------------------
// Op.deserialize()
// ---------------------------------------------------------------------------
describe('Op.deserialize()', () => {
  test('reads SHA256 tag (0x08) and returns an OpSHA256 instance', () => {
    const ctx = new DeserializeContext(Buffer.from([OpSHA256.TAG]))
    const op = Op.deserialize(ctx)
    expect(op).toBeInstanceOf(OpSHA256)
  })

  test('reads OpAppend tag (0xf0) followed by varbytes arg', () => {
    const ctx = new DeserializeContext(Buffer.from([OpAppend.TAG, 0x02, 0xaa, 0xbb]))
    const op = Op.deserialize(ctx)
    expect(op).toBeInstanceOf(OpAppend)
    expect(op.arg).toEqual(Buffer.from([0xaa, 0xbb]))
  })

  test('reads OpPrepend tag (0xf1) followed by varbytes arg', () => {
    const ctx = new DeserializeContext(Buffer.from([OpPrepend.TAG, 0x01, 0xcc]))
    const op = Op.deserialize(ctx)
    expect(op).toBeInstanceOf(OpPrepend)
    expect(op.arg).toEqual(Buffer.from([0xcc]))
  })

  test('throws on unknown tag', () => {
    const ctx = new DeserializeContext(Buffer.from([0x99]))
    expect(() => Op.deserialize(ctx)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Op.serialize / Op.deserialize round-trip
// ---------------------------------------------------------------------------
describe('Op serialize / deserialize round-trip', () => {
  test('OpAppend round-trips through serialize then deserialize', () => {
    const original = new OpAppend(Buffer.from([0xde, 0xad]))
    const sctx = new SerializeContext()
    original.serialize(sctx)
    const dctx = new DeserializeContext(sctx.getOutput())
    const restored = Op.deserialize(dctx)
    expect(restored).toBeInstanceOf(OpAppend)
    expect(restored.arg).toEqual(Buffer.from([0xde, 0xad]))
  })

  test('OpPrepend round-trips through serialize then deserialize', () => {
    const original = new OpPrepend(Buffer.from([0xbe, 0xef]))
    const sctx = new SerializeContext()
    original.serialize(sctx)
    const dctx = new DeserializeContext(sctx.getOutput())
    const restored = Op.deserialize(dctx)
    expect(restored).toBeInstanceOf(OpPrepend)
    expect(restored.arg).toEqual(Buffer.from([0xbe, 0xef]))
  })

  test('OpSHA256 round-trips through serialize then deserialize', () => {
    const original = new OpSHA256()
    const sctx = new SerializeContext()
    original.serialize(sctx)
    const dctx = new DeserializeContext(sctx.getOutput())
    const restored = Op.deserialize(dctx)
    expect(restored).toBeInstanceOf(OpSHA256)
  })
})

// ---------------------------------------------------------------------------
// OpBinary.uniqueId()
// ---------------------------------------------------------------------------
describe('OpBinary.uniqueId()', () => {
  test('two OpAppend with same arg produce equal uniqueIds', () => {
    const a = new OpAppend(Buffer.from([0x01, 0x02]))
    const b = new OpAppend(Buffer.from([0x01, 0x02]))
    expect(a.uniqueId().equals(b.uniqueId())).toBe(true)
  })

  test('two OpAppend with different args produce different uniqueIds', () => {
    const a = new OpAppend(Buffer.from([0x01]))
    const b = new OpAppend(Buffer.from([0x02]))
    expect(a.uniqueId().equals(b.uniqueId())).toBe(false)
  })

  test('OpAppend and OpPrepend with same arg produce different uniqueIds', () => {
    const a = new OpAppend(Buffer.from([0x01]))
    const b = new OpPrepend(Buffer.from([0x01]))
    expect(a.uniqueId().equals(b.uniqueId())).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Op.equals()
// ---------------------------------------------------------------------------
describe('Op.equals()', () => {
  test('same OpAppend args are equal', () => {
    const a = new OpAppend(Buffer.from([0xaa]))
    const b = new OpAppend(Buffer.from([0xaa]))
    expect(a.equals(b)).toBe(true)
  })

  test('different OpAppend args are not equal', () => {
    const a = new OpAppend(Buffer.from([0xaa]))
    const b = new OpAppend(Buffer.from([0xbb]))
    expect(a.equals(b)).toBe(false)
  })

  test('OpAppend and OpPrepend with same arg are not equal', () => {
    const a = new OpAppend(Buffer.from([0xaa]))
    const b = new OpPrepend(Buffer.from([0xaa]))
    expect(a.equals(b)).toBe(false)
  })

  test('two OpSHA256 instances are equal', () => {
    expect(new OpSHA256().equals(new OpSHA256())).toBe(true)
  })

  test('returns false for non-Op argument', () => {
    const a = new OpAppend(Buffer.from([0xaa]))
    expect(a.equals('not an op')).toBe(false)
  })
})
