import assert from 'assert'
import { parseInternalLinks } from './url.js'

const testCases = [
  ['https://stacker.news/items/123', '#123'],
  ['https://stacker.news/items/123/related', '#123/related'],
  // invalid links should not be parsed so user can spot error
  ['https://stacker.news/items/123foobar', undefined],
  // parse referral links
  ['https://stacker.news/items/123/r/ekzyis', '#123'],
  // use comment id if available
  ['https://stacker.news/items/123?commentId=456', '#456'],
  // comment id + referral link
  ['https://stacker.news/items/123/r/ekzyis?commentId=456', '#456'],
  // multiple params
  ['https://stacker.news/items/123?commentId=456&parentId=789', '#456']
]

for (const [href, expected] of testCases) {
  const actual = parseInternalLinks(href)
  if (actual !== expected) {
    assert(false, `${href} - expected: ${expected} got: ${actual}`)
  }
}
