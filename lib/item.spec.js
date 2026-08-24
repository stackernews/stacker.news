/* eslint-env jest */

import { getDeleteCommand, getDeleteAt, getReminderCommand, getRemindAt, isValidSchedulerDate } from './item.js'

describe('getDeleteCommand', () => {
  it('parses valid commands', () => {
    expect(getDeleteCommand('@delete in 5 days')).toEqual({ number: 5, unit: 'day' })
    expect(getDeleteCommand('@delete in 1 second')).toEqual({ number: 1, unit: 'second' })
  })

  it('uses the last command if there are multiple', () => {
    expect(getDeleteCommand('@delete in 5 days @delete in 2 weeks')).toEqual({ number: 2, unit: 'week' })
  })

  it('returns undefined without a command', () => {
    expect(getDeleteCommand('no command here')).toBeUndefined()
    expect(getDeleteCommand(null)).toBe(false)
  })
})

describe('getReminderCommand', () => {
  it('parses valid commands', () => {
    expect(getReminderCommand('@remindme in 30 minutes')).toEqual({ number: 30, unit: 'minute' })
  })

  it('returns undefined without a command', () => {
    expect(getReminderCommand('nothing to see here')).toBeUndefined()
  })
})

describe('scheduler date overflow', () => {
  // https://github.com/stackernews/stacker.news regression:
  // intervals parsed from user text were passed unvalidated into datePivot,
  // which can overflow the representable Date range
  const overflowCases = [
    '@delete in 99999999999999 years',
    '@remindme in 99999999999999 years',
    `@delete in ${'9'.repeat(400)} seconds`
  ]

  test.each(overflowCases)('%s produces an invalid date', (text) => {
    const deleteAt = getDeleteAt(text)
    const remindAt = getRemindAt(text)
    const result = deleteAt ?? remindAt
    expect(result).toBeTruthy()
    expect(isValidSchedulerDate(result)).toBe(false)
    // and this is what used to reach the database layer as a raw timestamp
    expect(result.toString()).toBe('Invalid Date')
  })

  it('sane commands produce valid dates', () => {
    expect(isValidSchedulerDate(getDeleteAt('@delete in 7 days'))).toBe(true)
    expect(isValidSchedulerDate(getRemindAt('@remindme in 10 minutes'))).toBe(true)
  })

  it('isValidSchedulerDate rejects non-dates', () => {
    expect(isValidSchedulerDate(new Date('not a date'))).toBe(false)
    expect(isValidSchedulerDate(null)).toBe(false)
    expect(isValidSchedulerDate(undefined)).toBe(false)
  })
})
