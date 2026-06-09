import { findAndReplace } from 'mdast-util-find-and-replace'

// from rehype-sn.js
const NOSTR_ID_PATTERN = /\b((npub1|nevent1|nprofile1|note1|naddr1)[02-9ac-hj-np-z]+)\b/g
const IGNORE_TYPES = ['code', 'inlineCode', 'link']

export function nostrTransform (tree) {
  findAndReplace(
    tree,
    [
      [
        NOSTR_ID_PATTERN,
        (value) => ({
          type: 'nostrId',
          value
        })
      ]
    ],
    { ignore: IGNORE_TYPES }
  )
}
