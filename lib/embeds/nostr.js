import { nip19 } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'
import { parse } from 'nostr-tools/nip27'
import { embedAvatar, embedPicture } from '@/lib/imgproxy'

const NJUMP_URL = 'https://njump.me'
// relay hints in links and events are ignored because they are user input
const READ_RELAYS = [
  'wss://nostr.mom',
  'wss://relay.ditto.pub',
  'wss://nostr.wine',
  'wss://nos.lol'
]
// primal's cache has the most notes, but it only answers lookups by id
const NOTE_CACHE = 'wss://cache2.primal.net/v1'
const RELAY_TIMEOUT_MS = 2500
const MAX_PROFILES = 10
const MAX_IMAGES = 4

const KIND_PROFILE = 0
const KIND_NOTE = 1
const KIND_ARTICLE = 30023
// event ids and pubkeys are 32-byte hex strings
const HEX_ID = /^[0-9a-f]{64}$/

// one pool for all lookups, so links fetched at the same time share the relay connections.
// relays refuse us when every link opens its own
const pool = new SimplePool()
// how many lookups are running
let fetching = 0

/** decodes a nostr id into the relay filter that finds it, null if the id is invalid */
export function nostrFilter (id) {
  try {
    const { type, data } = nip19.decode(id)
    switch (type) {
      case 'note':
        return { ids: [data] }
      case 'nevent':
        return { ids: [data.id] }
      case 'npub':
        return { kinds: [KIND_PROFILE], authors: [data] }
      case 'nprofile':
        return { kinds: [KIND_PROFILE], authors: [data.pubkey] }
      case 'naddr':
        return { kinds: [data.kind], authors: [data.pubkey], '#d': [data.identifier] }
      default:
        return null
    }
  } catch {
    return null
  }
}

/** fetches the event of a nostr id and the profiles needed to show it.
 * null if no relay has the event, throws if no relay could be reached
 */
export async function fetchNostr (id) {
  const filter = nostrFilter(id)
  if (!filter) return null

  fetching++
  try {
    const [event] = await query(filter)
    if (!event) {
      // with no relay connected we don't know if the event exists
      const connected = [...pool.listConnectionStatus().values()].some(Boolean)
      if (!connected) throw new Error('no nostr relay could be reached')
      return null
    }
    if (event.kind === KIND_PROFILE) return { event, profiles: [event] }

    // the profiles of the author and of the people a note mentions, to show their names
    const pubkeys = new Set([event.pubkey])
    if (event.kind === KIND_NOTE) {
      for (const block of parse(noteText(event))) {
        if (block.type === 'reference' && isProfilePointer(block.pointer)) pubkeys.add(block.pointer.pubkey)
      }
    }
    const profiles = await query({ kinds: [KIND_PROFILE], authors: [...pubkeys].slice(0, MAX_PROFILES) })
    return { event, profiles }
  } finally {
    // the last lookup closes the connections, so none stay open unused
    // and a relay that refused us is tried again next time.
    // note: this is a workaround for nostr-tools 2.16 while nostr-tools 2.24 and later do both by default
    if (--fetching === 0) pool.destroy()
  }
}

// queries all relays and returns the newest event of each author
function query (filter) {
  return new Promise(resolve => {
    const newest = new Map()
    const relays = filter.ids ? [NOTE_CACHE, ...READ_RELAYS] : READ_RELAYS
    pool.subscribeEose(relays, filter, {
      maxWait: RELAY_TIMEOUT_MS,
      onevent (event) {
        // an event id has no newer version, the first result is enough
        if (filter.ids) return resolve([event])

        const current = newest.get(event.pubkey)
        if (!current || event.created_at > current.created_at) newest.set(event.pubkey, event)
      },
      onclose: () => resolve([...newest.values()])
    })
  })
}

// old notes mention profiles and events as #[n], the index of a tag (NIP-08).
// we convert them to nostr: references, so they are parsed like the current ones (NIP-27).
// the parser skips nostr:note1 references, so we convert those to nevent too
function noteText ({ content, tags }) {
  return content
    .replace(/#\[(\d+)\]/g, (match, index) => {
      const [name, value] = tags[index] ?? []
      if (!HEX_ID.test(value)) return match
      if (name === 'p') return `nostr:${nip19.npubEncode(value)}`
      if (name === 'e') return `nostr:${nip19.neventEncode({ id: value })}`
      return match
    })
    .replace(/nostr:(note1[02-9ac-hj-np-z]+)/g, (match, note) => {
      try {
        return `nostr:${nip19.neventEncode({ id: nip19.decode(note).data })}`
      } catch {
        return match
      }
    })
}

// nip27 pointers have no type: event pointers have an id, address pointers an identifier, profile pointers neither
const isProfilePointer = pointer => !('id' in pointer) && !('identifier' in pointer)

/** converts the result of fetchNostr to embed data, null for kinds we don't show */
export function normalizeNostr ({ event, profiles }) {
  const authors = new Map(profiles.map(profile => [profile.pubkey, metadata(profile)]))
  const author = toAuthor(event.pubkey, authors.get(event.pubkey))
  const tag = name => event.tags.find(([t]) => t === name)?.[1]

  switch (event.kind) {
    case KIND_PROFILE:
      return {
        href: author.href,
        author,
        ...content(clean(authors.get(event.pubkey).about) ?? '', authors)
      }
    case KIND_NOTE:
      return {
        href: `${NJUMP_URL}/${nip19.neventEncode({ id: event.id, author: event.pubkey })}`,
        createdAt: new Date(event.created_at * 1000).toISOString(),
        author,
        ...content(noteText(event), authors)
      }
    case KIND_ARTICLE:
      return {
        href: `${NJUMP_URL}/${nip19.naddrEncode({ kind: event.kind, pubkey: event.pubkey, identifier: tag('d') ?? '' })}`,
        createdAt: new Date(event.created_at * 1000).toISOString(),
        author,
        title: tag('title'),
        text: tag('summary') ? [{ text: tag('summary') }] : [],
        media: [embedPicture(tag('image'))].filter(Boolean)
      }
    default:
      return null
  }
}

// profile content is JSON written by the user, it can be invalid
function metadata (profile) {
  try {
    const parsed = JSON.parse(profile.content)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const clean = value => typeof value === 'string' && value.trim() ? value.trim() : null
const short = bech32 => `${bech32.slice(0, 12)}…`

function toAuthor (pubkey, profile = {}) {
  const npub = nip19.npubEncode(pubkey)
  return {
    name: clean(profile.display_name) ?? clean(profile.name) ?? short(npub),
    // a profile can claim any nip05, so we show the npub
    handle: short(npub),
    href: `${NJUMP_URL}/${npub}`,
    avatar: embedAvatar(clean(profile.picture))
  }
}

// splits the note text into plain text and links, and moves images to media
function content (text, authors) {
  const segments = []
  const media = []
  const push = segment => {
    const last = segments.at(-1)
    // merge consecutive plain text into one segment
    if (last && !last.href && !segment.href) last.text += segment.text
    else segments.push(segment)
  }

  for (const block of parse(text)) {
    switch (block.type) {
      case 'text':
        push({ text: block.text })
        break
      case 'image': {
        const image = media.length < MAX_IMAGES && embedPicture(block.url)
        if (image) media.push(image)
        else push({ text: block.url, href: block.url })
        break
      }
      case 'reference':
        push(reference(block.pointer, authors))
        break
      case 'relay':
        // relay urls are shown as plain text
        push({ text: block.url })
        break
      case 'url':
      case 'video':
      case 'audio':
        push({ text: block.url, href: block.url })
        break
    }
  }

  // trim the blank lines left where images at the end of the text were moved to media
  const last = segments.at(-1)
  if (last && !last.href) last.text = last.text.trimEnd()
  return { text: segments.filter(s => s.text), media }
}

function reference (pointer, authors) {
  if (isProfilePointer(pointer)) {
    const author = toAuthor(pointer.pubkey, authors.get(pointer.pubkey))
    return { text: `@${author.name}`, href: author.href }
  }
  const bech32 = 'id' in pointer
    ? nip19.neventEncode({ id: pointer.id })
    : nip19.naddrEncode({ kind: pointer.kind, pubkey: pointer.pubkey, identifier: pointer.identifier })
  return { text: short(bech32), href: `${NJUMP_URL}/${bech32}` }
}
