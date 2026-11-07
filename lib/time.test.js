import { describe, test } from 'node:test'
import { expect } from 'expect'

import { raceAbort } from './time.js'

describe('raceAbort', () => {
  test('resolves when no signal is given', async () => {
    expect(await raceAbort(Promise.resolve('value'))).toBe('value')
  })

  test('rejects with the promise error when no signal is given', async () => {
    await expect(raceAbort(Promise.reject(new Error('boom')))).rejects.toThrow('boom')
  })

  test('resolves with the promise value when the signal never aborts', async () => {
    const controller = new AbortController()
    expect(await raceAbort(Promise.resolve('value'), controller.signal)).toBe('value')
  })

  test('rejects with the abort reason when the signal aborts mid-race', async () => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new Error('mid-flight abort')), 5)
    await expect(raceAbort(new Promise(() => {}), controller.signal)).rejects.toThrow('mid-flight abort')
  })

  test('rejects with the abort reason when the signal is already aborted', async () => {
    const reason = new Error('caller cancelled')
    const controller = new AbortController()
    controller.abort(reason)
    await expect(raceAbort(new Promise(() => {}), controller.signal)).rejects.toBe(reason)
  })

  test('keeps an already-rejected promise observed when the signal is already aborted', async () => {
    const reason = new Error('caller cancelled')
    const controller = new AbortController()
    controller.abort(reason)

    await expect(
      raceAbort(Promise.reject(new Error('operation failed')), controller.signal)
    ).rejects.toBe(reason)

    // give any detached rejection a tick to surface; with --unhandled-rejections=strict
    // the process would die before reaching this if the input rejection went unobserved
    await new Promise(resolve => setImmediate(resolve))
  })

  test('keeps a late-rejecting promise observed when the signal is already aborted', async () => {
    const reason = new Error('caller cancelled')
    const controller = new AbortController()
    controller.abort(reason)

    const operation = new Promise((_resolve, reject) => setTimeout(() => reject(new Error('operation failed')), 10))
    await expect(raceAbort(operation, controller.signal)).rejects.toBe(reason)

    await new Promise(resolve => setTimeout(resolve, 50))
  })
})
