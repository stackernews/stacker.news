/* eslint-env jest */

import { addTextExpansionToQuery, isTextExpandedInQuery, SHOW_FULL_TEXT_QUERY_PARAM } from './text-expansion'

describe('text expansion query state', () => {
  test('detects an expanded item id in string and array query values', () => {
    expect(isTextExpandedInQuery('123', 123)).toBe(true)
    expect(isTextExpandedInQuery(['123', '456'], 456)).toBe(true)
    expect(isTextExpandedInQuery(['123', '456'], 789)).toBe(false)
    expect(isTextExpandedInQuery(undefined, 123)).toBe(false)
  })

  test('adds the expanded item id without mutating existing query state', () => {
    const query = { nodata: 'true', [SHOW_FULL_TEXT_QUERY_PARAM]: '123' }
    const nextQuery = addTextExpansionToQuery(query, 456)

    expect(query[SHOW_FULL_TEXT_QUERY_PARAM]).toBe('123')
    expect(nextQuery).toEqual({
      nodata: 'true',
      [SHOW_FULL_TEXT_QUERY_PARAM]: ['123', '456']
    })
  })

  test('keeps repeated expansions unique', () => {
    expect(addTextExpansionToQuery({ [SHOW_FULL_TEXT_QUERY_PARAM]: ['123'] }, '123')).toEqual({
      [SHOW_FULL_TEXT_QUERY_PARAM]: '123'
    })
  })
})
