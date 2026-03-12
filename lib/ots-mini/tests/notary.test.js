/* eslint-env jest */

import { Notary, RemoteCalendar, catSHA256, makeMerkleTree } from '../notary.js'
import { DetachedTimestampFile, Timestamp } from '../timestamp.js'
import { PendingAttestation } from '../attestation.js'
import { OpSHA256 } from '../ops.js'
import { SerializeContext } from '../encoding.js'
import { MAX_MSG_LENGTH } from '../constants.js'

// ---------------------------------------------------------------------------
// Shared test helper
// ---------------------------------------------------------------------------
function makeDetached () {
  return DetachedTimestampFile.fromHash(new OpSHA256(), Buffer.alloc(32))
}

/**
 * Build a mock calendar response: a minimal serialized Timestamp that
 * carries one PendingAttestation. The response is what RemoteCalendar.submit
 * would receive from a real calendar server.
 */
function buildCalendarResponse (digest, calendarUrl) {
  const stamp = new Timestamp(digest)
  stamp.attestations.push(new PendingAttestation(calendarUrl))
  const sctx = new SerializeContext()
  stamp.serialize(sctx)
  return sctx.getOutput()
}

// ---------------------------------------------------------------------------
// RemoteCalendar.submit — response body consumed on error
// ---------------------------------------------------------------------------
describe('RemoteCalendar.submit consumes response body on error', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    delete globalThis.fetch
  })

  test('consumes response body on non-200 response', async () => {
    const arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(0))
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      arrayBuffer
    })

    const cal = new RemoteCalendar('https://a.example.com')
    await expect(cal.submit(Buffer.alloc(32))).rejects.toThrow()
    expect(arrayBuffer).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// RemoteCalendar.submit — timeout nullish coalescing
// ---------------------------------------------------------------------------
describe('RemoteCalendar.submit passes explicit timeout', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    delete globalThis.fetch
  })

  test('explicit timeout:0 is passed to AbortSignal, not replaced by default', async () => {
    const timeoutSpy = jest.spyOn(globalThis.AbortSignal, 'timeout').mockReturnValue(undefined)
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0))
    })

    const cal = new RemoteCalendar('https://a.example.com')
    await cal.submit(Buffer.alloc(32), 0).catch(() => {})

    expect(timeoutSpy).toHaveBeenCalledWith(0)
  })
})

// ---------------------------------------------------------------------------
// RemoteCalendar.submit — response body exceeding MAX_MSG_LENGTH
// ---------------------------------------------------------------------------
describe('RemoteCalendar.submit rejects oversized response', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    delete globalThis.fetch
  })

  test('throws when response body exceeds MAX_MSG_LENGTH', async () => {
    const oversized = new ArrayBuffer(MAX_MSG_LENGTH + 1)
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: jest.fn().mockResolvedValue(oversized)
    })

    const cal = new RemoteCalendar('https://a.example.com')
    await expect(cal.submit(Buffer.alloc(32))).rejects.toThrow(/exceeded/)
  })
})

// ---------------------------------------------------------------------------
// Notary.stamp — calendar URL validation
// ---------------------------------------------------------------------------
describe('Notary.stamp validates calendar URLs', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    delete globalThis.fetch
  })

  test('rejects non-HTTPS calendar URL without making a fetch request', async () => {
    globalThis.fetch = jest.fn()
    const dtf = makeDetached()
    await expect(
      Notary.stamp(dtf, { calendars: ['http://evil.com'], m: 1 })
    ).rejects.toThrow()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test('rejects an invalid (non-URL) calendar entry without making a fetch request', async () => {
    globalThis.fetch = jest.fn()
    const dtf = makeDetached()
    await expect(
      Notary.stamp(dtf, { calendars: ['not-a-url'], m: 1 })
    ).rejects.toThrow()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Notary.stamp — m > calendars.length throws before any fetch
// ---------------------------------------------------------------------------
describe('Notary.stamp validates m parameter', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    delete globalThis.fetch
  })

  test('throws when m > number of calendars', async () => {
    globalThis.fetch = jest.fn()
    const dtf = makeDetached()
    await expect(
      Notary.stamp(dtf, { calendars: ['https://a.example.com'], m: 5 })
    ).rejects.toThrow(/invalid m/)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Notary.stamp — happy path with mocked fetch
// ---------------------------------------------------------------------------
describe('Notary.stamp happy path', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    delete globalThis.fetch
  })

  test('mutates DetachedTimestampFile with attestations after stamp', async () => {
    const dtf = makeDetached()

    // We intercept fetch to return a valid calendar response.
    // The digest sent to the calendar is the Merkle tip, which we don't
    // know in advance. We capture it from the fetch call and build the
    // response dynamically.
    globalThis.fetch = jest.fn().mockImplementation(async (url, opts) => {
      const digest = Buffer.from(opts.body)
      const responseBytes = buildCalendarResponse(digest, url)
      return {
        ok: true,
        status: 200,
        arrayBuffer: jest.fn().mockResolvedValue(responseBytes.buffer.slice(
          responseBytes.byteOffset,
          responseBytes.byteOffset + responseBytes.byteLength
        ))
      }
    })

    const calendars = ['https://a.example.com', 'https://b.example.com']
    await Notary.stamp(dtf, { calendars, m: 2 })

    // The DTF should now have ops (nonce append + SHA256 at minimum)
    expect(dtf.timestamp.ops.size).toBeGreaterThan(0)

    // Walk the tree to find attestations
    function collectAttestations (ts) {
      const result = [...ts.attestations]
      ts.ops.forEach(child => {
        result.push(...collectAttestations(child))
      })
      return result
    }

    const attestations = collectAttestations(dtf.timestamp)
    expect(attestations.length).toBeGreaterThanOrEqual(2)
  })

  test('stamps multiple DetachedTimestampFiles', async () => {
    const dtf1 = makeDetached()
    const dtf2 = makeDetached()

    globalThis.fetch = jest.fn().mockImplementation(async (url, opts) => {
      const digest = Buffer.from(opts.body)
      const responseBytes = buildCalendarResponse(digest, url)
      return {
        ok: true,
        status: 200,
        arrayBuffer: jest.fn().mockResolvedValue(responseBytes.buffer.slice(
          responseBytes.byteOffset,
          responseBytes.byteOffset + responseBytes.byteLength
        ))
      }
    })

    const calendars = ['https://a.example.com', 'https://b.example.com']
    await Notary.stamp([dtf1, dtf2], { calendars, m: 2 })

    // Both should have ops added
    expect(dtf1.timestamp.ops.size).toBeGreaterThan(0)
    expect(dtf2.timestamp.ops.size).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// catSHA256 / makeMerkleTree — known hash vectors
// ---------------------------------------------------------------------------
describe('catSHA256 produces correct Merkle hash', () => {
  test('SHA256("foo" || "bar") matches known vector', () => {
    const left = new Timestamp(Buffer.from('foo'))
    const right = new Timestamp(Buffer.from('bar'))
    const result = catSHA256(left, right)
    expect(result.msg.toString('hex')).toBe('c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2')
  })

  test('catSHA256 chained twice matches known vector', () => {
    const left = new Timestamp(Buffer.from('foo'))
    const right = new Timestamp(Buffer.from('bar'))
    const stamplr = catSHA256(left, right)
    const righter = new Timestamp(Buffer.from('baz'))
    const result = catSHA256(stamplr, righter)
    expect(result.msg.toString('hex')).toBe('23388b16c66f1fa37ef14af8eb081712d570813e2afb8c8ae86efa726f3b7276')
  })
})

// Known Merkle root hashes
const MERKLE_ROOTS = [
  [2, 'b413f47d13ee2fe6c845b2ee141af81de858df4ec549a58b7970bb96645bc8d2'],
  [3, 'e6aa639123d8aac95d13d365ec3779dade4b49c083a8fed97d7bfc0d89bb6a5e'],
  [4, '7699a4fdd6b8b6908a344f73b8f05c8e1400f7253f544602c442ff5c65504b24'],
  [5, 'aaa9609d0c949fee22c1c941a4432f32dc1c2de939e4af25207f0dc62df0dbd8'],
  [6, 'ebdb4245f648b7e77b60f4f8a99a6d0529d1d372f98f35478b3284f16da93c06'],
  [7, 'ba4603a311279dea32e8958bfb660c86237157bf79e6bfee857803e811d91b8f']
]

describe('makeMerkleTree() produces known Merkle roots', () => {
  for (const [n, expectedRoot] of MERKLE_ROOTS) {
    test(`${n} leaves → root ${expectedRoot.slice(0, 8)}…`, () => {
      const leaves = Array.from({ length: n }, (_, i) => new Timestamp(Buffer.from([i])))
      const merkleTip = makeMerkleTree(leaves)
      expect(merkleTip.msg.toString('hex')).toBe(expectedRoot)
    })
  }
})

// ---------------------------------------------------------------------------
// makeMerkleTree edge cases
// ---------------------------------------------------------------------------
describe('makeMerkleTree edge cases', () => {
  test('single leaf returns itself', () => {
    const leaf = new Timestamp(Buffer.from([0x42]))
    const result = makeMerkleTree([leaf])
    expect(result).toBe(leaf)
  })

  test('empty array throws', () => {
    expect(() => makeMerkleTree([])).toThrow(/empty/)
  })
})

// ---------------------------------------------------------------------------
// Integration: fromHash → stamp (mocked) → serializeToBytes → deserialize
// ---------------------------------------------------------------------------
describe('end-to-end integration: stamp → serialize → deserialize', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    delete globalThis.fetch
  })

  test('full round-trip preserves attestations through serialization', async () => {
    const hash = Buffer.alloc(32, 0xab)
    const dtf = DetachedTimestampFile.fromHash(new OpSHA256(), hash)

    globalThis.fetch = jest.fn().mockImplementation(async (url, opts) => {
      const digest = Buffer.from(opts.body)
      const responseBytes = buildCalendarResponse(digest, url)
      return {
        ok: true,
        status: 200,
        arrayBuffer: jest.fn().mockResolvedValue(responseBytes.buffer.slice(
          responseBytes.byteOffset,
          responseBytes.byteOffset + responseBytes.byteLength
        ))
      }
    })

    await Notary.stamp(dtf, {
      calendars: ['https://a.example.com', 'https://b.example.com'],
      m: 2
    })

    // Serialize to bytes, then deserialize
    const bytes = dtf.serializeToBytes()
    const restored = DetachedTimestampFile.deserialize(bytes)

    // The restored DTF should have the same hash
    expect(restored.timestamp.msg).toEqual(hash)
    expect(restored.fileHashOp).toBeInstanceOf(OpSHA256)

    // Walk tree to collect attestations — should find at least the 2 calendar URIs
    function collectAttestations (ts) {
      const result = [...ts.attestations]
      ts.ops.forEach(child => {
        result.push(...collectAttestations(child))
      })
      return result
    }

    const attestations = collectAttestations(restored.timestamp)
    expect(attestations.length).toBeGreaterThanOrEqual(2)
    const uris = attestations.map(a => a.uri)
    expect(uris).toContain('https://a.example.com/digest')
    expect(uris).toContain('https://b.example.com/digest')
  })
})
