import { describe, test, afterEach, mock } from 'node:test'
import { expect } from 'expect'

import { Notary, RemoteCalendar } from '../notary.js'

import { PendingAttestation } from '../attestation.js'
import { MAX_RESPONSE_SIZE } from '../constants.js'
import { SerializeContext } from '../encoding.js'
import { OpSHA256 } from '../ops.js'
import { DetachedTimestampFile, Timestamp } from '../timestamp.js'

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

/** construct a fetch reader mock for a resolver */
function makeReaderWithResolver (resolver) {
  let called = false
  return function () {
    return {
      read () {
        if (!called) {
          called = true
          return resolver()
        }
        return Promise.resolve({ done: true, value: undefined })
      }
    }
  }
}

/** construct a fetch reader mock to replay an ArrayBuffer in chunks */
function makeReader (ab, chunkSize = 100) {
  let pos = 0
  const buf = Buffer.from(ab)
  return function () {
    return {
      read () {
        let chunk
        if (buf.byteLength === pos) {
          return Promise.resolve({ done: true, value: undefined })
        } else if (buf.byteLength > pos + chunkSize) {
          chunk = buf.slice(pos, pos + chunkSize)
          pos += chunkSize
        } else {
          chunk = buf.slice(pos)
          pos = buf.byteLength
        }
        return Promise.resolve({ done: false, value: chunk })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// RemoteCalendar.submit — response body consumed on error
// ---------------------------------------------------------------------------
describe('RemoteCalendar.submit consumes response body on error', () => {
  afterEach(() => {
    mock.restoreAll()
    delete globalThis.fetch
  })

  test('consumes response body on non-200 response', async () => {
    const prom = mock.fn(async () => ({ done: false, value: new ArrayBuffer(1) }))
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 500,
      body: { getReader: makeReaderWithResolver(prom) }
    }))

    const cal = new RemoteCalendar('https://a.example.com')
    await expect(cal.submit(Buffer.alloc(32))).rejects.toThrow()
    expect(prom.mock.callCount()).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// RemoteCalendar.submit — timeout nullish coalescing
// ---------------------------------------------------------------------------
describe('RemoteCalendar.submit passes explicit timeout', () => {
  afterEach(() => {
    mock.restoreAll()
    delete globalThis.fetch
  })

  test('explicit timeout:0 is passed to AbortSignal, not replaced by default', async () => {
    const timeoutSpy = mock.method(globalThis.AbortSignal, 'timeout')
    globalThis.fetch = mock.fn(() => ({
      ok: false,
      status: 500,
      body: { getReader: makeReader(new ArrayBuffer(0)) }
    }))

    const cal = new RemoteCalendar('https://a.example.com')
    await cal.submit(Buffer.alloc(32), 0).catch(() => {})

    expect(globalThis.fetch.mock.callCount()).toBe(1)
    expect(timeoutSpy.mock.callCount()).toBe(1)
    expect(timeoutSpy.mock.calls[0].arguments[0]).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// RemoteCalendar.submit — response body exceeding MAX_RESPONSE_SIZE
// ---------------------------------------------------------------------------
describe('RemoteCalendar.submit rejects oversized response', () => {
  afterEach(() => {
    mock.restoreAll()
    delete globalThis.fetch
  })

  test('throws when response body exceeds MAX_RESPONSE_SIZE', async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      body: { getReader: makeReader(new ArrayBuffer(MAX_RESPONSE_SIZE + 1), 1000) }
    }))

    const cal = new RemoteCalendar('https://a.example.com')
    await expect(cal.submit(Buffer.alloc(32))).rejects.toThrow(/exceeded/)
  })
})

// ---------------------------------------------------------------------------
// RemoteCalendar.submit — trailing data in response
// ---------------------------------------------------------------------------
describe('RemoteCalendar.submit rejects trailing data', () => {
  afterEach(() => {
    mock.restoreAll()
    delete globalThis.fetch
  })

  test('throws when response body contains bytes past serialization end', async () => {
    globalThis.fetch = mock.fn(async (url, opts) => {
      const digest = Buffer.from(opts.body)
      const responseBytes = buildCalendarResponse(digest, url)
      return {
        ok: true,
        status: 200,
        body: { getReader: makeReader(Buffer.concat([responseBytes, Buffer.from([0x01])])) }
      }
    })

    const cal = new RemoteCalendar('https://a.example.com')
    await expect(cal.submit(Buffer.alloc(32))).rejects.toThrow(/trailing data/)
  })
})

// ---------------------------------------------------------------------------
// AbortSignal.timeout: slow-stream defence
// ---------------------------------------------------------------------------
describe('RemoteCalendar.submit timeout mitigates slow-stream attacks', () => {
  afterEach(() => {
    mock.restoreAll()
    delete globalThis.fetch
  })

  test('aborts a drip-feeding response within the timeout window', { timeout: 2000 }, async (t) => {
    const shortTimeout = 300

    globalThis.fetch = mock.fn(async (url, opts) => {
      const signal = opts.signal

      return {
        ok: true,
        status: 200,
        body: {
          getReader () {
            return {
              async read () {
                if (t.signal.aborted) {
                  throw new Error('test window exceeded')
                }
                if (signal.aborted) {
                  return { done: true, value: undefined }
                }
                // Drip-feed: 1 byte every 200ms
                await new Promise(resolve => setTimeout(resolve, 200))
                if (signal.aborted) {
                  return { done: true, value: undefined }
                }
                return { done: false, value: new Uint8Array([0x00]) }
              }
            }
          }
        }
      }
    })

    const cal = new RemoteCalendar('https://evil.example.com')
    await expect(cal.submit(Buffer.alloc(32), shortTimeout)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Notary.stamp — calendar URL validation
// ---------------------------------------------------------------------------
describe('Notary.stamp validates calendar URLs', () => {
  afterEach(() => {
    mock.restoreAll()
    delete globalThis.fetch
  })

  test('rejects non-HTTPS calendar URL without making a fetch request', async () => {
    globalThis.fetch = mock.fn()
    const dtf = makeDetached()
    await expect(
      Notary.stamp(dtf, { calendars: ['http://evil.com'], m: 1 })
    ).rejects.toThrow()
    expect(globalThis.fetch.mock.callCount()).toBe(0)
  })

  test('rejects an invalid (non-URL) calendar entry without making a fetch request', async () => {
    globalThis.fetch = mock.fn()
    const dtf = makeDetached()
    await expect(
      Notary.stamp(dtf, { calendars: ['not-a-url'], m: 1 })
    ).rejects.toThrow()
    expect(globalThis.fetch.mock.callCount()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Notary.stamp — m > calendars.length throws before any fetch
// ---------------------------------------------------------------------------
describe('Notary.stamp validates m parameter', () => {
  afterEach(() => {
    mock.restoreAll()
    delete globalThis.fetch
  })

  test('throws when m > number of calendars', async () => {
    globalThis.fetch = mock.fn()
    const dtf = makeDetached()
    await expect(
      Notary.stamp(dtf, { calendars: ['https://a.example.com'], m: 5 })
    ).rejects.toThrow(/invalid m/)
    expect(globalThis.fetch.mock.callCount()).toBe(0)
  })

  test('rejects m=0 before any network call', async () => {
    globalThis.fetch = mock.fn()
    const dtf = DetachedTimestampFile.fromHash(new OpSHA256(), Buffer.alloc(32))
    await expect(
      Notary.stamp(dtf, { calendars: ['https://a.example.com'], m: 0 })
    ).rejects.toThrow(/invalid m/)
    expect(globalThis.fetch.mock.callCount()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Notary.stamp — happy path with mocked fetch
// ---------------------------------------------------------------------------
describe('Notary.stamp happy path', () => {
  afterEach(() => {
    mock.restoreAll()
    delete globalThis.fetch
  })

  test('mutates DetachedTimestampFile with attestations after stamp', async () => {
    const dtf = makeDetached()

    // We intercept fetch to return a valid calendar response.
    // The digest sent to the calendar is the Merkle tip, which we don't
    // know in advance. We capture it from the fetch call and build the
    // response dynamically.
    globalThis.fetch = mock.fn(async (url, opts) => {
      const digest = Buffer.from(opts.body)
      const responseBytes = buildCalendarResponse(digest, url)
      return {
        ok: true,
        status: 200,
        body: {
          getReader: makeReader(responseBytes.buffer.slice(
            responseBytes.byteOffset,
            responseBytes.byteOffset + responseBytes.byteLength
          ))
        }
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

    globalThis.fetch = mock.fn(async (url, opts) => {
      const digest = Buffer.from(opts.body)
      const responseBytes = buildCalendarResponse(digest, url)
      return {
        ok: true,
        status: 200,
        body: {
          getReader: makeReader(responseBytes.buffer.slice(
            responseBytes.byteOffset,
            responseBytes.byteOffset + responseBytes.byteLength
          ))
        }
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
// Integration: fromHash → stamp (mocked) → serializeToBytes → deserialize
// ---------------------------------------------------------------------------
describe('end-to-end integration: stamp → serialize → deserialize', () => {
  afterEach(() => {
    mock.restoreAll()
    delete globalThis.fetch
  })

  test('full round-trip preserves attestations through serialization', async () => {
    const hash = Buffer.alloc(32, 0xab)
    const dtf = DetachedTimestampFile.fromHash(new OpSHA256(), hash)

    globalThis.fetch = mock.fn(async (url, opts) => {
      const digest = Buffer.from(opts.body)
      const responseBytes = buildCalendarResponse(digest, url)
      return {
        ok: true,
        status: 200,
        body: {
          getReader: makeReader(responseBytes.buffer.slice(
            responseBytes.byteOffset,
            responseBytes.byteOffset + responseBytes.byteLength
          ))
        }
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
