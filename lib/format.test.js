import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ensureB64, hexToB64 } from './format.js'

test('hexToB64 preserves complete hex bytes and accepts either case', () => {
  assert.equal(hexToB64('00abcdef'), 'AKvN7w==')
  assert.equal(hexToB64('00ABCDEF'), 'AKvN7w==')
})

test('hexToB64 rejects incomplete bytes instead of discarding the last nibble', () => {
  for (const value of ['abc', 'deadbeef0', '00010203f', 'a']) {
    assert.throws(() => hexToB64(value), /invalid hex encoding/)
  }
})

test('hexToB64 rejects nonhex text and empty input', () => {
  for (const value of ['xx', 'ab zz', 'ab\ncd', '0x12', '', null, undefined, 12345]) {
    assert.throws(() => hexToB64(value), /invalid hex encoding/)
  }
})

test('ensureB64 keeps the existing even-length hex precedence', () => {
  assert.equal(ensureB64('abcd'), 'q80=')
  assert.equal(ensureB64('00AB'), 'AKs=')
})

test('ensureB64 treats valid odd-length hex-looking input as Base64 without truncating', () => {
  for (const value of ['abc', 'ab0', 'ab1']) {
    assert.equal(ensureB64(value), value + '=')
    assert.deepEqual(Buffer.from(ensureB64(value), 'base64'), Buffer.from(value, 'base64'))
  }
})

test('ensureB64 rejects odd-length input that is also invalid Base64', () => {
  assert.throws(() => ensureB64('deadbeef0'), /not a valid/)
  assert.throws(() => ensureB64('a'), /not a valid/)
})

test('ensureB64 preserves standard and URL-safe Base64 and padding', () => {
  assert.equal(ensureB64('qw=='), 'qw==')
  assert.equal(ensureB64('AQID-_8='), 'AQID+/8=')
  assert.equal(ensureB64('AQID-_8'), 'AQID+/8=')
  assert.equal(ensureB64('AQID+/8='), 'AQID+/8=')
})
