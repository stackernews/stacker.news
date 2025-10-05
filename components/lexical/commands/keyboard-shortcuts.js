import { SN_TOGGLE_MODE_COMMAND } from '@/components/lexical/plugins/mode/switch'
import { SN_FORMAT_TEXT_COMMAND } from '@/components/lexical/universal/commands/formatting'
import { IS_APPLE } from '@lexical/utils'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/lexical/universal/commands/upload'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/universal/commands/links'
import { FORMAT_ELEMENT_COMMAND, OUTDENT_CONTENT_COMMAND, INDENT_CONTENT_COMMAND } from 'lexical'

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
    combo: 'alt+shift+q',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, 'quote')
    }
  }
]

export const ALIGN_SHORTCUTS = [
  {
    action: 'align-left',
    combo: 'mod+shift+l',
    handler: ({ editor }) => {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')
    }
  },
  {
    action: 'align-center',
    combo: 'mod+shift+e',
    handler: ({ editor }) => {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')
    }
  },
  {
    action: 'align-right',
    combo: 'mod+shift+r',
    handler: ({ editor }) => {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')
    }
  },
  {
    action: 'align-justify',
    combo: 'mod+shift+j',
    handler: ({ editor }) => {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify')
    }
  },
  {
    action: 'indent-decrease',
    combo: 'TODO',
    handler: ({ editor }) => {
      editor.dispatchCommand(OUTDENT_CONTENT_COMMAND)
    }
  },
  {
    action: 'indent-increase',
    combo: 'TODO',
    handler: ({ editor }) => {
      editor.dispatchCommand(INDENT_CONTENT_COMMAND)
    }
  }
]

export const INSERT_SHORTCUTS = [
  {
    action: 'upload',
    combo: 'mod+shift+u',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)
    }
  },
  {
    action: 'link',
    combo: 'mod+k',
    handler: ({ editor }) => {
      editor.dispatchCommand(SN_TOGGLE_LINK_COMMAND, '')
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
  ...INLINE_FORMATTING_SHORTCUTS,
  ...ALIGN_SHORTCUTS,
  ...INSERT_SHORTCUTS
]

export function getShortcutCombo (action) {
  const shortcut = SHORTCUTS.find(shortcut => shortcut.action === action)
  if (!shortcut) return null
  return shortcut.combo.replace('mod', IS_APPLE ? 'cmd' : 'ctrl').replace('alt', IS_APPLE ? 'opt' : 'alt').toLowerCase()
}
