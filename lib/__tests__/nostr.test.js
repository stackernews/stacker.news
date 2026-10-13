/* eslint-env jest */

import { zapRequestRelays, DEFAULT_CROSSPOSTING_RELAYS } from '../nostr'

describe('zapRequestRelays', () => {
  test('returns the request relays when the tag exists', () => {
    const note = {
      tags: [
        ['p', 'cd'.repeat(32)],
        ['relays', 'wss://relay.damus.io/', 'wss://nostrue.com/']
      ]
    }
    expect(zapRequestRelays(note)).toEqual(['wss://relay.damus.io/', 'wss://nostrue.com/'])
  })

  test('falls back to our own relays when the tag is missing (issue #3218)', () => {
    const note = { tags: [['p', 'cd'.repeat(32)], ['amount', '21000']] }
    expect(zapRequestRelays(note)).toEqual(DEFAULT_CROSSPOSTING_RELAYS)
  })

  test('falls back when the relays tag is empty or has no values', () => {
    expect(zapRequestRelays({ tags: [['relays']] })).toEqual(DEFAULT_CROSSPOSTING_RELAYS)
    expect(zapRequestRelays({ tags: [['relays', '']] })).toEqual(DEFAULT_CROSSPOSTING_RELAYS)
  })

  test('ignores malformed tags and notes without tags', () => {
    expect(zapRequestRelays({ tags: [['relays'], [null], ['relays', 'wss://a.com']] })).toEqual(['wss://a.com'])
    expect(zapRequestRelays({ tags: null })).toEqual(DEFAULT_CROSSPOSTING_RELAYS)
    expect(zapRequestRelays(null)).toEqual(DEFAULT_CROSSPOSTING_RELAYS)
  })
})
