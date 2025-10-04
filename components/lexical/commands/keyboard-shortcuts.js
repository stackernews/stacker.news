import { SN_TOGGLE_MODE_COMMAND } from '@/components/lexical/plugins/mode/switch'
import { SN_FORMAT_TEXT_COMMAND } from '@/components/lexical/universal/commands/formatting'

function isMac () {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform)
}

// mod is either cmd or ctrl
export const INLINE_FORMATTING_SHORTCUTS = [
  {
    action: 'bold',
    combo: 'mod+b',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, 'bold')
    }
  },
  {
    action: 'italic',
    combo: 'mod+i',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, 'italic')
    }
  },
  {
    action: 'underline',
    combo: 'mod+u',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, 'underline')
    }
  },
  {
    action: 'code',
    combo: 'mod+shift+c',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, 'code')
    }
  },
  {
    action: 'strikethrough',
    combo: 'mod+shift+x',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, 'strikethrough')
    }
  },
  {
    action: 'quote',
    combo: 'mod+shift+q',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, 'quote')
    }
  }
]

export const EDITOR_SHORTCUTS = [
  {
    action: 'toggleMode',
    combo: 'mod+shift+m',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_TOGGLE_MODE_COMMAND)
    }
  },
  {
    action: 'test',
    combo: 'mod+shift+t',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, 'test')
    }
  }
]

export const SHORTCUTS = [
  ...EDITOR_SHORTCUTS,
  ...INLINE_FORMATTING_SHORTCUTS
]

export function getShortcutCombo (action) {
  const shortcut = SHORTCUTS.find(shortcut => shortcut.action === action)
  if (!shortcut) return null
  return shortcut.combo.replace('mod', isMac() ? 'cmd' : 'ctrl').toLowerCase()
}
