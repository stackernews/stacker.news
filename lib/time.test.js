import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'
import { raceAbort } from './time.js'

const root = fileURLToPath(new URL('../', import.meta.url))

describe('raceAbort', () => {
  for (const delayed of [false, true]) {
    test(`observes a ${delayed ? 'later' : 'current'} rejection when already aborted`, () => {
      const child = spawnSync(process.execPath, [
        '--unhandled-rejections=strict', '--import', './scripts/register-alias.mjs',
        '--input-type=module', '-e', `
          import assert from 'node:assert/strict'
          import { setTimeout } from 'node:timers/promises'
          import { raceAbort } from './lib/time.js'
          const controller = new AbortController()
          const reason = new Error('caller cancelled')
          controller.abort(reason)
          const operation = ${delayed
            ? "setTimeout(10).then(() => { throw new Error('operation failed') })"
            : "Promise.reject(new Error('operation failed'))"}
          await assert.rejects(raceAbort(operation, controller.signal), error => error === reason)
          await setTimeout(30)
          console.log('abort observed without unhandled rejection')
        `
      ], { cwd: root, encoding: 'utf8', timeout: 10000 })
      assert.equal(child.error, undefined)
      assert.equal(child.status, 0, child.stderr)
      assert.match(child.stdout, /abort observed without unhandled rejection/)
    })
  }

  test('keeps the default pre-aborted reason', async () => {
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(raceAbort(Promise.resolve('ignored'), controller.signal),
      error => error === controller.signal.reason && error.name === 'AbortError')
  })

  test('keeps an explicit pre-aborted reason', async () => {
    const controller = new AbortController()
    const reason = { message: 'cancelled by caller' }
    controller.abort(reason)
    await assert.rejects(raceAbort(Promise.resolve('ignored'), controller.signal),
      error => error === reason)
  })

  test('passes fulfillment and rejection through without a signal', async () => {
    const value = { result: 42 }
    const error = new Error('operation failed')
    assert.equal(await raceAbort(Promise.resolve(value)), value)
    await assert.rejects(raceAbort(Promise.reject(error)), actual => actual === error)
  })

  test('removes the listener after fulfillment', async () => {
    const controller = new AbortController()
    assert.equal(await raceAbort(Promise.resolve(42), controller.signal), 42)
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  })

  test('removes the listener after rejection', async () => {
    const controller = new AbortController()
    const error = new Error('operation failed')
    await assert.rejects(raceAbort(Promise.reject(error), controller.signal), actual => actual === error)
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  })

  test('later cancellation observes the losing operation rejection', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled while waiting')
    let rejectOperation
    const operation = new Promise((resolve, reject) => { rejectOperation = reject })
    const result = raceAbort(operation, controller.signal)
    controller.abort(reason)
    await assert.rejects(result, error => error === reason)
    rejectOperation(new Error('operation failed later'))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  })
})
