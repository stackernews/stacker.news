import { randomBytes } from 'node:crypto'
import { DEFAULT_CALENDARS, MIN_CALENDAR_RESPONSES, MAX_MSG_LENGTH } from './constants.js'
import { DeserializeContext } from './encoding.js'
import { OpAppend, OpPrepend, OpSHA256 } from './ops.js'
import { DetachedTimestampFile, Timestamp } from './timestamp.js'

export class RemoteCalendar {
  constructor (url) {
    this.url = url // string, e.g. 'https://a.pool.opentimestamps.org'
    this.defaultTimeout = 30 * 1000
  }

  /**
   * POST {url}/digest with the raw digest bytes as the request body.
   * Returns the deserialized pending-attestation Timestamp on success.
   * Throws on non-200 or network failure.
   */
  async submit (digest, timeout) {
    if (typeof globalThis.fetch !== 'function') {
      throw new Error('RemoteCalendar.submit: globalThis.fetch is not available (requires Node.js 18+ or a fetch polyfill)')
    }
    if (typeof globalThis.AbortSignal?.timeout !== 'function') {
      throw new Error('RemoteCalendar.submit: AbortSignal.timeout is not available (requires Node.js 17.3+ or a polyfill)')
    }
    const res = await globalThis.fetch(`${this.url}/digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, // note: although this content type doesn't make sense, it matches the implementation
      body: digest,
      signal: globalThis.AbortSignal.timeout(timeout ?? this.defaultTimeout)
    })
    let buf
    try {
      buf = await res.arrayBuffer()
    } catch (e) {
      throw new Error(`calendar ${this.url}: failed to read response body: ${e.message}`)
    }
    if (!res.ok) throw new Error(`calendar ${this.url} returned ${res.status}`)
    if (buf.byteLength > MAX_MSG_LENGTH) {
      throw new Error(`RemoteCalendar.submit: Response from remote exceeded ${MAX_MSG_LENGTH} bytes`)
    }
    const ctx = new DeserializeContext(Buffer.from(buf))
    return Timestamp.deserialize(ctx, digest)
  }
}

/**
 * Link two leaf Timestamps into a single parent via SHA-256(left.msg || right.msg).
 * Mutates both left and right (adds op-edges), returns the shared parent Timestamp.
 */
export function catSHA256 (left, right) {
  if (!(left instanceof Timestamp) || !(right instanceof Timestamp)) {
    throw new Error('catSHA256: both left and right must be instances of Timestamp')
  }
  const sharedChild = left.add(new OpAppend(right.msg))
  right.ops.set(new OpPrepend(left.msg), sharedChild)
  return sharedChild.add(new OpSHA256())
}

/**
 * Build a Merkle Mountain Range over an array of leaf Timestamps.
 * Returns the single Merkle tip Timestamp.
 */
export function makeMerkleTree (leaves) {
  if (leaves.length === 0) throw new Error('empty leaves')
  if (leaves.length === 1) return leaves[0]

  let stamps = leaves.slice()
  while (stamps.length > 1) {
    const nextPass = []
    for (let i = 0; i + 1 < stamps.length; i += 2) {
      nextPass.push(catSHA256(stamps[i], stamps[i + 1]))
    }
    if (stamps.length % 2 === 1) nextPass.push(stamps[stamps.length - 1])
    stamps = nextPass
  }
  return stamps[0]
}

export class Notary {
  /**
   * Stamp one or more DetachedTimestampFile objects.
   *
   * Steps:
   *   1. Normalise detached to an array.
   *   2. For each file: append a 16-byte random nonce, hash with SHA-256 → Merkle leaf.
   *   3. Build a Merkle tree over all leaves → merkleTip.
   *   4. Submit merkleTip.msg concurrently to all calendars.
   *   5. Require at least options.m (default 2) successes; throw otherwise.
   *   6. Merge each successful calendar Timestamp into merkleTip.
   *
   * Each DetachedTimestampFile is mutated in-place; returns void.
   */
  static async stamp (detached, options = {}) {
    const detachedList = detached instanceof DetachedTimestampFile ? [detached] : detached

    const calendars = options.calendars ?? DEFAULT_CALENDARS
    for (const url of calendars) {
      let parsed
      try {
        parsed = new URL(url)
      } catch {
        throw new Error(`Notary.stamp: invalid calendar URL: ${url}`)
      }
      if (parsed.protocol !== 'https:') {
        throw new Error(`Notary.stamp: calendar URL must use HTTPS: ${url}`)
      }
    }
    const m = options.m ?? MIN_CALENDAR_RESPONSES
    if (m <= 0 || m > calendars.length) {
      throw new Error(`Notary.stamp: invalid m value: ${m}`)
    }

    // Step 2 — nonce + SHA-256 per file
    const merkleLeaves = detachedList.map(dtf => {
      const nonce = randomBytes(16)
      const nonceStamp = dtf.timestamp.add(new OpAppend(nonce))
      return nonceStamp.add(new OpSHA256())
    })

    // Step 3 — Merkle tree
    const merkleTip = makeMerkleTree(merkleLeaves)

    // Step 4 — concurrent calendar submissions
    const results = await Promise.allSettled(
      calendars.map(url => new RemoteCalendar(url).submit(merkleTip.msg))
    )

    // Step 5 — require m successes
    const successes = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
    if (successes.length < m) {
      throw new Error(
        `Notary.stamp: only ${successes.length} of ${calendars.length} calendars responded (need ${m})`
      )
    }

    // Step 6 — merge into Merkle tip (propagates to all DetachedTimestampFiles)
    for (const calTs of successes) merkleTip.merge(calTs)
  }
}
