import { IS_APPLE } from '@lexical/utils'
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_HIGH, isModifierMatch } from 'lexical'
import { defineExtension } from '@lexical/extension'
import { SHORTCUTS } from './keyboard'

// experimental
function getNormalizedKey (e) {
  const { code, key } = e
  if (!code) return (key || '').toLowerCase()

  // letter keys
  if (code.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase()

  // digits on top row and numpad
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5)
  if (code.startsWith('Numpad') && /^\d$/.test(code.slice(6))) return code.slice(6)

  // punctuations
  const special = {
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: '\'',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\',
    Minus: '-',
    Equal: '=',
    Backquote: '`',
    Space: ' '
  }
  if (special[code]) return special[code]

  return (key || '').toLowerCase()
}

// experimental
function parseCombo (combo) {
  const parts = combo.split('+').map(p => p.trim().toLowerCase())
  const mask = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }
  let key = null

  for (const p of parts) {
    if (p === 'mod') {
      if (IS_APPLE) mask.metaKey = true
      else mask.ctrlKey = true
    } else if (p === 'cmd' || p === 'meta') {
      mask.metaKey = true
    } else if (p === 'ctrl') {
      mask.ctrlKey = true
    } else if (p === 'alt' || p === 'opt') {
      mask.altKey = true
    } else if (p === 'shift') {
      mask.shiftKey = true
    } else {
      key = p
    }
  }
  return { mask, key }
}

// experimental
function matches (e, combo) {
  const combos = Array.isArray(combo) ? combo : [combo]
  const normalized = getNormalizedKey(e)

  for (const c of combos) {
    const { mask, key } = parseCombo(c)
    if (isModifierMatch(e, mask) && normalized === key) return true
  }
  return false
}

export const ShortcutsExtension = defineExtension({
  name: 'ShortcutsExtension',
  config: { shortcuts: SHORTCUTS },
  register: (editor, { shortcuts }) => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (e) => {
        if (!editor.isEditable()) return false
        for (const { combo, handler } of shortcuts) {
          if (matches(e, combo)) {
            e.preventDefault()
            handler({ editor, event: e })
            return true
          }
        }
        return false
      },
      COMMAND_PRIORITY_HIGH
    )
  }
})
