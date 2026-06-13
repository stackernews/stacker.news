/* eslint-env jest */

import { shouldSuppressFormSubmitToast } from './form'
import { TimeoutError } from './time'

describe('shouldSuppressFormSubmitToast', () => {
  test.each([
    ['TimeoutError', new TimeoutError(30000)],
    ['AbortError', Object.assign(new Error('aborted'), { name: 'AbortError' })],
    ['network statusCode 504', { networkError: { statusCode: 504 } }],
    ['network status 504', { networkError: { status: 504 } }],
    ['network response status 504', { networkError: { response: { status: 504 } } }],
    ['top-level statusCode 504', { statusCode: 504 }],
    ['Apollo 504 message', { networkError: { message: 'Response not successful: Received status code 504' } }]
  ])('suppresses %s', (_, err) => {
    expect(shouldSuppressFormSubmitToast(err)).toBe(true)
  })

  test.each([
    ['business error', new Error('insufficient funds')],
    ['network statusCode 500', { networkError: { statusCode: 500, message: 'Response not successful: Received status code 500' } }],
    ['failed to fetch', new Error('Failed to fetch')],
    ['network status 400', { networkError: { status: 400, message: 'Response not successful: Received status code 400' } }],
    ['empty error', {}]
  ])('does not suppress %s', (_, err) => {
    expect(shouldSuppressFormSubmitToast(err)).toBe(false)
  })
})
