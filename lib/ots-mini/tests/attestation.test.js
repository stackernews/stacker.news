/* eslint-env jest */

import { Attestation, PendingAttestation } from '../attestation.js'

import { MAX_ATTESTATION_URI_SIZE } from '../constants.js'
import { SerializeContext, DeserializeContext } from '../encoding.js'

// ---------------------------------------------------------------------------
// PendingAttestation constructor validates URI
// ---------------------------------------------------------------------------
describe('PendingAttestation constructor validates URI', () => {
  test('rejects null URI', () => {
    expect(() => new PendingAttestation(null)).toThrow(/non-empty string/)
  })

  test('rejects empty string URI', () => {
    expect(() => new PendingAttestation('')).toThrow(/non-empty string/)
  })

  test('rejects non-string URI', () => {
    expect(() => new PendingAttestation(42)).toThrow(/non-empty string/)
  })
})

// ---------------------------------------------------------------------------
// PendingAttestation.deserialize validates UTF-8
// ---------------------------------------------------------------------------
describe('PendingAttestation.deserialize validates UTF-8', () => {
  test('throws on invalid UTF-8 payload (0xFF byte)', () => {
    const invalidUtf8 = Buffer.from([0x02, 0x01, 0xff])
    const ctx = new DeserializeContext(invalidUtf8)
    expect(() => PendingAttestation.deserialize(ctx)).toThrow(/not valid UTF-8/)
  })

  test('throws on truncated multi-byte UTF-8 sequence (0xC2 alone)', () => {
    const invalidUtf8 = Buffer.from([0x02, 0x01, 0xc2])
    const ctx = new DeserializeContext(invalidUtf8)
    expect(() => PendingAttestation.deserialize(ctx)).toThrow(/not valid UTF-8/)
  })
})

// ---------------------------------------------------------------------------
// PendingAttestation serialization round-trip
// ---------------------------------------------------------------------------
describe('PendingAttestation serialization round-trip', () => {
  test('serialize then deserialize recovers the URI', () => {
    const pa = new PendingAttestation('foobar')
    const ctx = new SerializeContext()
    pa.serialize(ctx)
    const payload = ctx.getOutput().slice(8)
    const pa2 = PendingAttestation.deserialize(new DeserializeContext(payload))
    expect(pa2.uri).toBe('foobar')
  })

  test('serialized form starts with PendingAttestation TAG bytes', () => {
    const pa = new PendingAttestation('foobar')
    const ctx = new SerializeContext()
    pa.serialize(ctx)
    expect(ctx.getOutput().slice(0, 8)).toEqual(Buffer.from(PendingAttestation.TAG))
  })

  test('rejects percent-encoded characters in URI on construction', () => {
    const ctx = new SerializeContext()
    expect(() => new PendingAttestation('fo%bar').serialize(ctx)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Attestation.deserialize static dispatch
// ---------------------------------------------------------------------------
describe('Attestation.deserialize static dispatch', () => {
  test('deserializes a full serialized PendingAttestation (TAG + varbytes)', () => {
    const pa = new PendingAttestation('https://example.com')
    const sctx = new SerializeContext()
    pa.serialize(sctx)
    const dctx = new DeserializeContext(sctx.getOutput())
    const result = Attestation.deserialize(dctx)
    expect(result).toBeInstanceOf(PendingAttestation)
    expect(result.uri).toBe('https://example.com')
  })

  test('throws on unknown tag', () => {
    const unknownTag = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x66, 0x6f, 0x6f])
    const ctx = new DeserializeContext(unknownTag)
    expect(() => Attestation.deserialize(ctx)).toThrow(/unimplemented tag/)
  })
})

// ---------------------------------------------------------------------------
// PendingAttestation.compare — cross-instance ordering
// ---------------------------------------------------------------------------
describe('PendingAttestation.compare', () => {
  test('"aaa" compares less than "zzz"', () => {
    const a = new PendingAttestation('aaa')
    const z = new PendingAttestation('zzz')
    expect(a.compare(z)).toBeLessThan(0)
    expect(z.compare(a)).toBeGreaterThan(0)
  })

  test('same URI compares as equal', () => {
    const a = new PendingAttestation('test')
    const b = new PendingAttestation('test')
    expect(a.compare(b)).toBe(0)
  })

  test('throws when comparing with non-Attestation', () => {
    const a = new PendingAttestation('test')
    expect(() => a.compare('not an attestation')).toThrow(/must be an Attestation/)
  })
})

// ---------------------------------------------------------------------------
// PendingAttestation.equals
// ---------------------------------------------------------------------------
describe('PendingAttestation.equals', () => {
  test('equal URIs produce true', () => {
    const a = new PendingAttestation('foo')
    const b = new PendingAttestation('foo')
    expect(a.equals(b)).toBe(true)
  })

  test('different URIs produce false', () => {
    const a = new PendingAttestation('foo')
    const b = new PendingAttestation('bar')
    expect(a.equals(b)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PendingAttestation deserialize honors limits
// ---------------------------------------------------------------------------
describe('PendingAttestation uri deserialization', () => {
  test('errors at uris > MAX_URI_SIZE', () => {
    const host = 'https://a.example.com/'
    const path = Buffer.alloc(MAX_ATTESTATION_URI_SIZE - host.length + 1).fill('a').toString('utf-8')
    const uri = [host, path].join('')
    const attn = new PendingAttestation(uri)

    const serializer = new SerializeContext()
    attn.serialize(serializer)
    const deserializer = new DeserializeContext(serializer.getOutput())
    expect(() => { Attestation.deserialize(deserializer) }).toThrow(/uri exceeds/)
  })

  test('does not error at uris == MAX_URI_SIZE', () => {
    const host = 'https://a.example.com/'
    const path = Buffer.alloc(MAX_ATTESTATION_URI_SIZE - host.length).fill('a').toString('utf-8')
    const uri = [host, path].join('')
    const attn = new PendingAttestation(uri)

    const serializer = new SerializeContext()
    attn.serialize(serializer)
    const deserializer = new DeserializeContext(serializer.getOutput())
    expect(() => { Attestation.deserialize(deserializer) }).not.toThrow()
  })
})
