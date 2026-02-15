import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useState } from 'react'
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical'
import { IS_APPLE } from '@lexical/utils'
import { SN_FORMAT_COMMAND } from '@/lib/lexical/commands/formatting/format'
import { SN_FORMAT_BLOCK_COMMAND } from '@/lib/lexical/commands/formatting/blocks'
import { SN_TOGGLE_LINK_COMMAND } from '@/lib/lexical/commands/links'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/editor/plugins/upload'
import { TOGGLE_MODE_COMMAND } from '@/components/editor/plugins/toolbar/switch'
import { SUBMIT_FORMIK_COMMAND } from '@/components/editor/plugins/core/formik'

export const SHORTCUTS = {
  link: {
    key: 'mod+KeyK',
    handler: (editor) => editor.dispatchCommand(SN_TOGGLE_LINK_COMMAND)
  },
  bold: {
    key: 'mod+KeyB',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_COMMAND, 'bold')
  },
  italic: {
    key: 'mod+KeyI',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_COMMAND, 'italic')
  },
  quote: {
    key: 'control+shift+KeyQ',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, 'quote')
  },
  inlineCode: {
    key: 'mod+KeyE',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_COMMAND, 'code')
  },
  superscript: {
    key: 'mod+Period',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_COMMAND, 'superscript')
  },
  subscript: {
    key: 'mod+Comma',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_COMMAND, 'subscript')
  },
  strikethrough: {
    key: 'mod+shift+KeyX',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_COMMAND, 'strikethrough')
  },
  h1: {
    key: 'mod+alt+Digit1',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, 'h1')
  },
  h2: {
    key: 'mod+alt+Digit2',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, 'h2')
  },
  h3: {
    key: 'mod+alt+Digit3',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, 'h3')
  },
  numberedList: {
    key: 'mod+shift+Digit7',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, 'number')
  },
  bulletList: {
    key: 'mod+shift+Digit8',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, 'bullet')
  },
  check: {
    key: 'mod+shift+Digit9',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, 'check')
  },
  codeblock: {
    key: 'mod+alt+KeyC',
    handler: (editor) => editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, 'code')
  },
  upload: {
    key: 'mod+KeyU',
    handler: (editor) => editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)
  },
  toggleMode: {
    key: 'mod+KeyM',
    handler: (editor) => editor.dispatchCommand(TOGGLE_MODE_COMMAND, editor)
  },
  submit: {
    key: 'mod+Enter',
    handler: (editor) => editor.dispatchCommand(SUBMIT_FORMIK_COMMAND)
  }
}

export default function ShortcutsPlugin ({ shortcuts = SHORTCUTS }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (e) => {
        for (const shortcut of Object.values(shortcuts)) {
          const { key, handler } = shortcut
          if (!key) continue

          const parts = key.toLowerCase().split('+')
          const needsMod = parts.includes('mod')
          const needsControl = parts.includes('control')
          const needsShift = parts.includes('shift')
          const needsAlt = parts.includes('alt')
          const targetCode = parts[parts.length - 1]

          const hasMod = e.metaKey || e.ctrlKey
          const hasControl = e.ctrlKey
          const hasShift = e.shiftKey
          const hasAlt = e.altKey

          if (needsMod && !hasMod) continue
          if (needsControl && !hasControl) continue
          if (needsShift !== hasShift) continue
          if (needsAlt !== hasAlt) continue

          // match against e.code (physical key) instead of e.key (character)
          if (e.code.toLowerCase() === targetCode) {
            const handled = handler(editor)
            // only prevent default behavior if the handler returned true
            if (handled) e.preventDefault()
            return handled
          }
        }
        return false
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor, shortcuts])

  return null
}

// modifier key display mapping
const MODIFIER_DISPLAY = {
  mod: IS_APPLE ? '⌘' : 'ctrl',
  control: IS_APPLE ? '⌃' : 'ctrl',
  alt: IS_APPLE ? '⌥' : 'alt'
}

// convert e.code values to display characters
function codeToDisplay (code) {
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Key')) return code.slice(3)
  const special = { Period: '.', Comma: ',', Enter: '↵', Slash: '/' }
  return special[code] || code
}

// format a shortcut key string for display (e.g., 'mod+shift+Digit1' -> '⌘+shift+1')
export function formatShortcut (key) {
  if (!key) return ''
  const parts = key.split('+')
  return parts.map(p => MODIFIER_DISPLAY[p.toLowerCase()] || codeToDisplay(p)).join('+')
}

// force shortcuts to render on the client (IS_APPLE comparison)
// client-side
export function useFormattedShortcut (key) {
  const [formatted, setFormatted] = useState('')

  useEffect(() => {
    setFormatted(key ? formatShortcut(key) : '')
  }, [key])

  return formatted
}
