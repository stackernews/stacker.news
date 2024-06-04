/* eslint-env jest */

import { parseInternalLinks } from './url.js'

const cases = [
  ['https://stacker.news/items/123', '#123'],
  ['https://stacker.news/items/123/related', '#123/related'],
  // invalid links should not be parsed so user can spot error
  ['https://stacker.news/items/123foobar', undefined],
  // Invalid origin should not be parsed so no malicious links
  ['https://example.com/items/123', undefined],
  // parse referral links
  ['https://stacker.news/items/123/r/ekzyis', '#123'],
  // use comment id if available
  ['https://stacker.news/items/123?commentId=456', '#456'],
  // comment id + referral link
  ['https://stacker.news/items/123/r/ekzyis?commentId=456', '#456'],
  // multiple params
  ['https://stacker.news/items/123?commentId=456&parentId=789', '#456']
]

describe('internal links', () => {
  test.each(cases)(
    'parses %p as %p',
    (href, expected) => {
      process.env.NEXT_PUBLIC_URL = 'https://stacker.news'
      const { linkText: actual } = parseInternalLinks(href)
      expect(actual).toBe(expected)
    }
  )
})
