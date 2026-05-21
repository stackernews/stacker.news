/* eslint-env jest */

import { formatPushBody } from './webPushFormat'

describe('formatPushBody', () => {
  it('removes markdown formatting from push notification bodies', () => {
    expect(formatPushBody('**bold** [link](https://stacker.news)')).toBe('bold link')
  })

  it('removes display math delimiters and punctuation escapes', () => {
    expect(formatPushBody('$$really\\,cool!$$')).toBe('really,cool!')
  })
})
