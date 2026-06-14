/* eslint-env jest */

import { execFileSync } from 'node:child_process'

describe('markdown helpers', () => {
  test('extracts user mentions using the markdown parser', () => {
    const script = `
      import assert from 'node:assert/strict'
      import { extractUserMentions } from './lib/md.js'

      const tick = String.fromCharCode(96)
      const fence = tick.repeat(3)
      const fencedCode = [fence + 'java', '@Entity', 'class Zap {}', fence, 'hello @alice'].join('\\n')

      assert.deepEqual(extractUserMentions('hello @alice and @bob'), ['alice', 'bob'])
      assert.deepEqual(extractUserMentions(fencedCode), ['alice'])
      assert.deepEqual(extractUserMentions('do not notify ' + tick + '@Entity' + tick + ' but notify @alice'), ['alice'])
      assert.deepEqual(extractUserMentions('[@alice](https://example.com) and @bob'), ['bob'])
      assert.deepEqual(extractUserMentions('@alice @alice @bob/thread'), ['alice', 'bob'])
    `

    expect(() => execFileSync('npx', ['tsx', '-e', script], {
      cwd: process.cwd()
    })).not.toThrow()
  })
})
