import { zapRequestRelays } from '../nostr'
import { DEFAULT_CROSSPOSTING_RELAYS } from '@/lib/nostr'

// Regression test for the NIP-57 receipt worker crash when the zap request
// has no `relays` tag (issue #3218). The payer has already paid by the time
// this runs, so it must not throw.
describe('zapRequestRelays', () => {
  it('returns the relays from the tag when present', () => {
    const note = { tags: [['p', 'ab'.repeat(32)], ['relays', 'wss://relay.one', 'wss://relay.two']] }
    expect(zapRequestRelays(note)).toEqual(['wss://relay.one', 'wss://relay.two'])
  })

  it('does not throw and falls back to defaults when the relays tag is absent', () => {
    const note = { pubkey: 'ab'.repeat(32), tags: [['p', 'cd'.repeat(32)], ['amount', '21000']] }
    expect(() => zapRequestRelays(note)).not.toThrow()
    expect(zapRequestRelays(note)).toEqual(DEFAULT_CROSSPOSTING_RELAYS)
  })

  it('falls back to defaults when the relays tag is present but empty', () => {
    const note = { tags: [['relays']] }
    expect(zapRequestRelays(note)).toEqual(DEFAULT_CROSSPOSTING_RELAYS)
  })

  it('handles a missing/undefined note without throwing', () => {
    expect(zapRequestRelays(undefined)).toEqual(DEFAULT_CROSSPOSTING_RELAYS)
    expect(zapRequestRelays({})).toEqual(DEFAULT_CROSSPOSTING_RELAYS)
  })
})