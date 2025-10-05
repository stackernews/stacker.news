import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { IS_APPLE } from '@lexical/utils'
import { SHORTCUTS } from './keyboard-shortcuts'

function translateEventToCombo (e) {
  const parts = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.metaKey) parts.push('meta')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push((e.key || '').toLowerCase())
  return parts.join('+')
}

function matches (e, combo) {
  const combos = Array.isArray(combo) ? combo : [combo]
  const eventCombo = translateEventToCombo(e)

  const compat = combos.flatMap(c => {
    if (c.includes('mod')) {
      const withMeta = c.replace('mod', 'meta')
      const withCtrl = c.replace('mod', 'ctrl')
      return IS_APPLE ? [withMeta] : [withCtrl]
    }
    return [c]
  })
  return [...combos, ...compat].some(c => c === eventCombo)
}

export default function ShortcutsPlugin ({ shortcuts = SHORTCUTS }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (e) => {
        for (const { combo, handler } of shortcuts) {
          if (matches(e, combo)) {
            e.preventDefault()
            handler({ editor, event: e })
            return true
          }
        }
        return false
      },
      COMMAND_PRIORITY_EDITOR
    )
  }, [editor, shortcuts])

  return null
}
