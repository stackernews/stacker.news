/* eslint-env jest */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { Timestamp, DetachedTimestampFile } from '../timestamp.js'
import { PendingAttestation } from '../attestation.js'
import { OpAppend, OpSHA256 } from '../ops.js'
import { SerializeContext, DeserializeContext } from '../encoding.js'
import { HEADER_MAGIC } from '../constants.js'

// ---------------------------------------------------------------------------
// Timestamp.add()
// Ported from: test/timestamp.js addOp, setResultTimestamp
// ---------------------------------------------------------------------------
describe('Timestamp.add()', () => {
  test('is idempotent: calling add twice with the same op returns the same child', () => {
    // Ported from: test/timestamp.js addOp
    const t = new Timestamp(Buffer.from('abcd'))
    const opAppend = new OpAppend(Buffer.from('efgh'))
    const child1 = t.add(opAppend)
    const child2 = t.add(opAppend)
    expect(child1).toBe(child2)
    expect(child1.msg).toEqual(Buffer.from('abcdefgh'))
  })

  test('chaining two ops produces the correct composed message', () => {
    // Ported from: test/timestamp.js setResultTimestamp
    const t1 = new Timestamp(Buffer.from('foo'))
    const opAppend1 = new OpAppend(Buffer.from('bar'))
    const opAppend2 = new OpAppend(Buffer.from('baz'))
    const t2 = t1.add(opAppend1) // t2.msg === 'foobar'
    const t3 = t2.add(opAppend2) // t3.msg === 'foobarbaz'
    expect(t3.msg).toEqual(Buffer.from('foobarbaz'))
  })
})

// ---------------------------------------------------------------------------
// Timestamp.serialize() / Timestamp.deserialize()
// Ported from: test/timestamp.js serialization
// ---------------------------------------------------------------------------
describe('Timestamp serialize / deserialize round-trip', () => {
  test('1 attestation', () => {
    const stamp = new Timestamp(Buffer.from('foo'))
    stamp.attestations.push(new PendingAttestation('foobar'))

    const ctx = new SerializeContext()
    stamp.serialize(ctx)
    const stamp2 = Timestamp.deserialize(new DeserializeContext(ctx.getOutput()), Buffer.from('foo'))

    expect(stamp2.attestations).toHaveLength(1)
    expect(stamp2.attestations[0].uri).toBe('foobar')
    expect(stamp2.ops.size).toBe(0)
  })

  test('2 attestations — both URIs survive the round-trip', () => {
    const stamp = new Timestamp(Buffer.from('foo'))
    stamp.attestations.push(new PendingAttestation('foobar'))
    stamp.attestations.push(new PendingAttestation('barfoo'))

    const ctx = new SerializeContext()
    stamp.serialize(ctx)
    const stamp2 = Timestamp.deserialize(new DeserializeContext(ctx.getOutput()), Buffer.from('foo'))

    expect(stamp2.attestations).toHaveLength(2)
    expect(stamp2.attestations.map(a => a.uri).sort()).toEqual(['barfoo', 'foobar'])
  })

  test('3 attestations — all URIs survive the round-trip', () => {
    const stamp = new Timestamp(Buffer.from('foo'))
    stamp.attestations.push(new PendingAttestation('foobar'))
    stamp.attestations.push(new PendingAttestation('barfoo'))
    stamp.attestations.push(new PendingAttestation('foobaz'))

    const ctx = new SerializeContext()
    stamp.serialize(ctx)
    const stamp2 = Timestamp.deserialize(new DeserializeContext(ctx.getOutput()), Buffer.from('foo'))

    expect(stamp2.attestations).toHaveLength(3)
    expect(stamp2.attestations.map(a => a.uri).sort()).toEqual(['barfoo', 'foobar', 'foobaz'])
  })

  test('attestations + 1 SHA256 op with child attestation', () => {
    // Ported from: test/timestamp.js serialization (last sub-case)
    const stamp = new Timestamp(Buffer.from('foo'))
    stamp.attestations.push(new PendingAttestation('foobar'))
    stamp.attestations.push(new PendingAttestation('barfoo'))
    stamp.attestations.push(new PendingAttestation('foobaz'))
    const sha256Stamp = stamp.add(new OpSHA256())
    sha256Stamp.attestations.push(new PendingAttestation('deeper'))

    const ctx = new SerializeContext()
    stamp.serialize(ctx)
    const stamp2 = Timestamp.deserialize(new DeserializeContext(ctx.getOutput()), Buffer.from('foo'))

    expect(stamp2.attestations).toHaveLength(3)
    expect(stamp2.ops.size).toBe(1)
    let childUri = null
    stamp2.ops.forEach(child => {
      if (child.attestations.length > 0) childUri = child.attestations[0].uri
    })
    expect(childUri).toBe('deeper')
  })
})

// ---------------------------------------------------------------------------
// Timestamp.merge()
// Ported from: test/timestamp.js merge
// ---------------------------------------------------------------------------
describe('Timestamp.merge()', () => {
  test('propagates attestations from other into this', () => {
    const stamp1 = new Timestamp(Buffer.from('a'))
    const stamp2 = new Timestamp(Buffer.from('a'))
    stamp2.attestations.push(new PendingAttestation('foobar'))
    stamp1.merge(stamp2)
    expect(stamp1.attestations).toHaveLength(1)
    expect(stamp1.attestations[0].uri).toBe('foobar')
  })

  test('does not duplicate attestations already present', () => {
    const stamp1 = new Timestamp(Buffer.from('a'))
    stamp1.attestations.push(new PendingAttestation('foobar'))
    const stamp2 = new Timestamp(Buffer.from('a'))
    stamp2.attestations.push(new PendingAttestation('foobar'))
    stamp1.merge(stamp2)
    expect(stamp1.attestations).toHaveLength(1)
  })

  test('validates msg equality', () => {
    // Original opentimestamps throws when merging timestamps whose .msg fields differ.
    // ots-mini does not enforce this constraint; the test documents current behavior.
    const stampA = new Timestamp(Buffer.from('a'))
    const stampB = new Timestamp(Buffer.from('b'))
    stampB.attestations.push(new PendingAttestation('foobar'))
    expect(() => stampA.merge(stampB)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DetachedTimestampFile round-trip
// Ported from: test/open-timestamps.js OpenTimestamps.serialize() and
//              OpenTimestamps.DetachedTimestampFile()
// ---------------------------------------------------------------------------
describe('DetachedTimestampFile round-trip', () => {
  test('serializeToBytes() then deserialize() preserves hash and attestations', () => {
    const hash = Buffer.alloc(32, 0xab)
    const dtf = DetachedTimestampFile.fromHash(new OpSHA256(), hash)
    dtf.timestamp.attestations.push(new PendingAttestation('https://example.com'))

    const bytes = dtf.serializeToBytes()
    const dtf2 = DetachedTimestampFile.deserialize(bytes)

    expect(dtf2.timestamp.msg).toEqual(hash)
    expect(dtf2.timestamp.attestations).toHaveLength(1)
    expect(dtf2.timestamp.attestations[0].uri).toBe('https://example.com')
  })

  test('deserialize() throws on wrong magic header', () => {
    expect(() => DetachedTimestampFile.deserialize(Buffer.alloc(64, 0x00))).toThrow()
  })

  test('deserialize() throws on unsupported version number', () => {
    const ctx = new SerializeContext()
    ctx.writeBytes(HEADER_MAGIC)
    ctx.writeVaruint(99) // wrong version
    ctx.writeByte(OpSHA256.TAG)
    ctx.writeBytes(Buffer.alloc(32))
    expect(() => DetachedTimestampFile.deserialize(ctx.getOutput())).toThrow()
  })
})

// ---------------------------------------------------------------------------
// DetachedTimestampFile on a known good .ots file
// Timestamped `14759b3eef13f3b401bfade03f7d0d4cc6653e1fd6c82145ca0de6dfaf118ef7`
// with the python opentimestamps-client, stored as `fixtures/known_good.ots`
// ---------------------------------------------------------------------------
describe('DetachedTimestampFile deserialization of python ots file', () => {
  test('deserialize a known good .ots file generated with python tooling', async () => {
    const sunny = await fs.readFile(path.join(__dirname, '/fixtures/known_good.ots'))
    const dtf = DetachedTimestampFile.deserialize(sunny)

    expect(dtf.fileHashOp._TAG()).toEqual(OpSHA256.TAG)
    expect(dtf.timestamp.msg.toString('hex')).toEqual('14759b3eef13f3b401bfade03f7d0d4cc6653e1fd6c82145ca0de6dfaf118ef7')

    function collectAttestations (ts) {
      const result = [...ts.attestations]
      ts.ops.forEach(child => {
        result.push(...collectAttestations(child))
      })
      return result
    }

    const attestations = collectAttestations(dtf.timestamp)
    expect(attestations.length).toEqual(4)
    expect(attestations[0].uri).toBe('https://bob.btc.calendar.opentimestamps.org')
    expect(attestations[1].uri).toBe('https://finney.calendar.eternitywall.com')
    expect(attestations[2].uri).toBe('https://btc.calendar.catallaxy.com')
    expect(attestations[3].uri).toBe('https://alice.btc.calendar.opentimestamps.org')
  })
})
