export const EDITOR_MODE_STORAGE_KEY = 'editorMode'
export const EDITOR_TOOLBAR_STORAGE_KEY = 'editorShowToolbar'

const EDITOR_MODES = new Set(['markdown', 'rich'])

export function readEditorMode (storage, fallback = 'markdown') {
  try {
    const value = storage?.getItem(EDITOR_MODE_STORAGE_KEY)
    return EDITOR_MODES.has(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function readEditorToolbarVisibility (storage, fallback) {
  try {
    const value = storage?.getItem(EDITOR_TOOLBAR_STORAGE_KEY)
    if (value === 'true') return true
    if (value === 'false') return false
    return fallback
  } catch {
    return fallback
  }
}

export function writeEditorSetting (storage, key, value) {
  try {
    storage?.setItem(key, String(value))
  } catch {}
}
