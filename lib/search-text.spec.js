/* eslint-env jest */

import { buildRelatedSource, pollOptionsText, searchableText } from './search-text'

describe('search text helpers', () => {
  test('joins poll options from strings and poll option records', () => {
    expect(pollOptionsText([
      'yes',
      { option: 'no' },
      { option: '' },
      null
    ])).toBe('yes\nno')
  })

  test('adds poll options to indexed searchable text', () => {
    expect(searchableText('**body** text', [{ option: 'choice one' }, { option: 'choice two' }]))
      .toBe('body text\n\nchoice one\nchoice two')
  })

  test('adds poll options to related-search source text', () => {
    expect(buildRelatedSource({
      title: 'Favorite wallet?',
      text: 'Which one do you use?',
      pollOptions: [{ option: 'LND' }, { option: 'CLN' }]
    })).toEqual({
      title: 'Favorite wallet?',
      hasBody: true,
      textQuery: 'Favorite wallet?\n\nWhich one do you use?\n\nLND\nCLN'
    })
  })
})
