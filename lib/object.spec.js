/* eslint-env jest */

import { get, move, remove, set } from './object'

describe('object helpers', () => {
  test.each([
    [{ a: 'b' }, '', { a: 'b' }],
    [{ a: 'b' }, 'a', 'b'],
    [{ a: { b: { c: 'd' } } }, 'a.b', { c: 'd' }]
  ])(
    'gets a nested value: get(%p, %p) returns %p',
    (obj, path, expected) => {
      expect(get(obj, path)).toEqual(expected)
    })

  test.each([
    [{ a: 'b' }, '', { a: 'b' }],
    [{ a: { b: { c: 'd' } } }, 'a.b.c', 'e', { a: { b: { c: 'e' } } }]
  ])(
    'sets a nested value: set(%p, %p, %p) returns %p',
    () => {
      const obj = { a: { b: { c: 'd' } } }
      set(obj, 'a.b.c', 'e')
      expect(obj).toEqual({ a: { b: { c: 'e' } } })
    })

  test.each([
    [{ a: 'b' }, 'a', {}],
    [{ a: { b: { c: 'd' } } }, 'a.b.c', { a: { b: {} } }]
  ])(
    'removes a nested values: remove(%p, %p) returns %p',
    (obj, path, expected) => {
      remove(obj, path)
      expect(obj).toEqual(expected)
    })

  test.each([
    [{ a: { b1: { c: 'd' } } }, 'a.b1.c', 'a.b1.d', { a: { b1: { d: 'd' } } }],
    [{ a: { b1: { c11: 'd1', c12: 'd2' }, b2: { c21: 'd3', c22: 'd4' } } }, 'a.b1.c11', 'a.b2.c22', { a: { b1: { c12: 'd2' }, b2: { c21: 'd3', c22: 'd1' } } }]
  ])(
    'moves a nested value: move(%p, %p, %p) returns %p',
    (obj, fromPath, toPath, expected) => {
      move(obj, fromPath, toPath)
      expect(obj).toEqual(expected)
    }
  )
})
