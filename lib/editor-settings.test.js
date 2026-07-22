/* eslint-env jest */

import {
  EDITOR_MODE_STORAGE_KEY,
  EDITOR_TOOLBAR_STORAGE_KEY,
  readEditorMode,
  readEditorToolbarVisibility,
  writeEditorSetting
} from './editor-settings'

function memoryStorage (entries = {}) {
  const values = new Map(Object.entries(entries))
  return {
    getItem: jest.fn(key => values.get(key) ?? null),
    setItem: jest.fn((key, value) => values.set(key, value))
  }
}

describe('editor settings storage', () => {
  it.each(['markdown', 'rich'])('reads a valid %s mode', mode => {
    const storage = memoryStorage({ [EDITOR_MODE_STORAGE_KEY]: mode })
    expect(readEditorMode(storage)).toBe(mode)
  })

  it('rejects an unknown stored mode', () => {
    const storage = memoryStorage({ [EDITOR_MODE_STORAGE_KEY]: 'invalid' })
    expect(readEditorMode(storage, 'markdown')).toBe('markdown')
  })

  it.each([
    ['true', true],
    ['false', false]
  ])('reads stored toolbar visibility %s', (stored, expected) => {
    const storage = memoryStorage({ [EDITOR_TOOLBAR_STORAGE_KEY]: stored })
    expect(readEditorToolbarVisibility(storage, !expected)).toBe(expected)
  })

  it('uses each editor context default when toolbar visibility is absent', () => {
    expect(readEditorToolbarVisibility(memoryStorage(), true)).toBe(true)
    expect(readEditorToolbarVisibility(memoryStorage(), false)).toBe(false)
  })

  it('serializes setting values', () => {
    const storage = memoryStorage()
    writeEditorSetting(storage, EDITOR_TOOLBAR_STORAGE_KEY, false)
    expect(storage.setItem).toHaveBeenCalledWith(EDITOR_TOOLBAR_STORAGE_KEY, 'false')
  })

  it('falls back without throwing when storage is unavailable', () => {
    const storage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') }
    }
    expect(readEditorMode(storage, 'markdown')).toBe('markdown')
    expect(readEditorToolbarVisibility(storage, true)).toBe(true)
    expect(() => writeEditorSetting(storage, EDITOR_MODE_STORAGE_KEY, 'rich')).not.toThrow()
  })
})
