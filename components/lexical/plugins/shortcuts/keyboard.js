import { SN_TOGGLE_MODE_COMMAND } from '@/components/lexical/plugins/mode/switch'
import { SN_FORMAT_TEXT_COMMAND } from '@/components/lexical/universal/commands/formatting/inline'
import { SN_FORMAT_BLOCK_COMMAND } from '@/components/lexical/universal/commands/formatting/blocks'
import { SN_FORMAT_ELEMENT_COMMAND } from '@/components/lexical/universal/commands/formatting/elements'
import { IS_APPLE } from '@lexical/utils'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/lexical/universal/commands/upload'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/universal/commands/links'
import { OUTDENT_CONTENT_COMMAND, INDENT_CONTENT_COMMAND } from 'lexical'
import { Actions, DefaultShortcuts } from '@/components/lexical/universal/constants/actions'
import { SN_INSERT_MATH_COMMAND } from '@/components/lexical/universal/commands/math'
import { SN_TABLE_DIALOG_COMMAND } from '@/components/lexical/universal/commands/table'

// shortcut configurations
const SHORTCUT_CONFIGS = {
  block: {
    actions: [
      'normal',
      'heading-1',
      'heading-2',
      'heading-3',
      'numbered-list',
      'bullet-list',
      'check-list',
      'quote',
      'code'
    ],
    command: SN_FORMAT_BLOCK_COMMAND,
    commandMap: {
      code: 'code-block'
    }
  },
  inline: {
    actions: ['bold', 'italic', 'underline', 'strikethrough'],
    command: SN_FORMAT_TEXT_COMMAND,
    commandMap: {
      code: 'code'
    }
  },
  align: {
    actions: ['left', 'center', 'right', 'justify'],
    command: SN_FORMAT_ELEMENT_COMMAND
  },
  indent: {
    actions: ['indent-decrease', 'indent-increase'],
    commandMap: {
      'indent-decrease': OUTDENT_CONTENT_COMMAND,
      'indent-increase': INDENT_CONTENT_COMMAND
    }
  },
  insert: {
    actions: ['upload', 'link', 'table', 'math', 'math-inline'],
    commandMap: {
      upload: SN_UPLOAD_FILES_COMMAND,
      link: SN_TOGGLE_LINK_COMMAND,
      table: SN_TABLE_DIALOG_COMMAND,
      math: SN_INSERT_MATH_COMMAND,
      'math-inline': SN_INSERT_MATH_COMMAND
    }
  },
  editor: {
    actions: ['toggleMode'],
    command: SN_TOGGLE_MODE_COMMAND
  }
}

// create shortcuts from configuration
const createShortcuts = (config) => {
  return config.actions.map(action => ({
    action: Actions[action],
    combo: DefaultShortcuts[action],
    handler: ({ editor }) => {
      if (config.commandMap && config.commandMap[action]) {
        // extra special command handling
        editor.dispatchCommand(config.commandMap[action],
          action === 'link'
            ? ''
            : action === 'math-inline'
              ? { inline: true }
              : undefined)
      } else if (config.command) {
        // standard command with action parameter
        const commandParam = config.commandMap?.[action] || Actions[action]
        editor.dispatchCommand(config.command, commandParam)
      }
    }
  }))
}

export const BLOCK_FORMATTING_SHORTCUTS = createShortcuts(SHORTCUT_CONFIGS.block)
export const INLINE_FORMATTING_SHORTCUTS = createShortcuts(SHORTCUT_CONFIGS.inline)
export const ALIGN_SHORTCUTS = createShortcuts(SHORTCUT_CONFIGS.align)
export const INDENT_SHORTCUTS = createShortcuts(SHORTCUT_CONFIGS.indent)
export const INSERT_SHORTCUTS = createShortcuts(SHORTCUT_CONFIGS.insert)
export const EDITOR_SHORTCUTS = createShortcuts(SHORTCUT_CONFIGS.editor)

export const SHORTCUTS = [
  ...EDITOR_SHORTCUTS,
  ...INLINE_FORMATTING_SHORTCUTS,
  ...BLOCK_FORMATTING_SHORTCUTS,
  ...ALIGN_SHORTCUTS,
  ...INDENT_SHORTCUTS,
  ...INSERT_SHORTCUTS
]

export function getShortcutCombo (action) {
  const shortcut = SHORTCUTS.find(shortcut => shortcut.action === action)
  if (!shortcut) return null
  return shortcut.combo.replace('mod', IS_APPLE ? 'cmd' : 'ctrl').replace('alt', IS_APPLE ? 'opt' : 'alt').toLowerCase()
}
