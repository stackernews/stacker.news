/**
 * lexical action registry
 *
 * possible properties:
 * - id: unique identifier
 * - name: ui name
 * - shortcut: bare keyboard combo (should use getShortcutCombo from shortcuts/keyboard.js)
 * - command: lexical command to dispatch
 * - commandValue: value to pass to command (defaults to id)
 * - category
 */

import { INDENT_CONTENT_COMMAND, OUTDENT_CONTENT_COMMAND } from 'lexical'
import { SN_FORMAT_BLOCK_COMMAND } from '@/components/lexical/universal/commands/formatting/blocks'
import { SN_FORMAT_ELEMENT_COMMAND } from '@/components/lexical/universal/commands/formatting/elements'
import { SN_FORMAT_TEXT_COMMAND } from '@/components/lexical/universal/commands/formatting/inline'
import { SN_INSERT_MATH_COMMAND } from '@/components/lexical/universal/commands/math'
import { SN_TOGGLE_MODE_COMMAND } from '@/components/lexical/extensions/core/mode'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/universal/commands/links'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/lexical/universal/commands/upload'

export const ACTIONS = [
  // inline text formatting
  {
    id: 'bold',
    name: 'bold',
    shortcut: 'mod+b',
    command: SN_FORMAT_TEXT_COMMAND,
    category: 'inline'
  },
  {
    id: 'italic',
    name: 'italic',
    shortcut: 'mod+i',
    command: SN_FORMAT_TEXT_COMMAND,
    category: 'inline'
  },
  {
    id: 'underline',
    name: 'underline',
    shortcut: 'mod+u',
    command: SN_FORMAT_TEXT_COMMAND,
    category: 'inline'
  },
  {
    id: 'strikethrough',
    name: 'strikethrough',
    shortcut: 'mod+shift+x',
    command: SN_FORMAT_TEXT_COMMAND,
    category: 'additional'
  },
  {
    id: 'code',
    name: 'inline code',
    shortcut: 'mod+shift+i',
    command: SN_FORMAT_TEXT_COMMAND,
    category: 'inline'
  },

  // block formatting
  {
    id: 'paragraph',
    name: 'paragraph',
    shortcut: 'mod+alt+0',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block'
  },
  {
    id: 'h1',
    name: 'heading 1',
    shortcut: 'mod+alt+1',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block'
  },
  {
    id: 'h2',
    name: 'heading 2',
    shortcut: 'mod+alt+2',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block'
  },
  {
    id: 'h3',
    name: 'heading 3',
    shortcut: 'mod+alt+3',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block'
  },
  {
    id: 'quote',
    name: 'quote',
    shortcut: 'mod+alt+q',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block'
  },
  {
    id: 'number',
    name: 'numbered list',
    shortcut: 'mod+shift+7',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block'
  },
  {
    id: 'bullet',
    name: 'bullet list',
    shortcut: 'mod+shift+8',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block'
  },
  {
    id: 'check',
    name: 'check list',
    shortcut: 'mod+shift+9',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block'
  },
  {
    id: 'code-block',
    name: 'code block',
    shortcut: 'mod+shift+c',
    command: SN_FORMAT_BLOCK_COMMAND,
    commandValue: 'code', // maps to 'code' in switch statement
    category: 'block'
  },

  // alignment
  {
    id: 'left',
    name: 'align left',
    shortcut: 'mod+shift+l',
    command: SN_FORMAT_ELEMENT_COMMAND,
    category: 'align'
  },
  {
    id: 'center',
    name: 'center',
    shortcut: 'mod+shift+e',
    command: SN_FORMAT_ELEMENT_COMMAND,
    category: 'align'
  },
  {
    id: 'right',
    name: 'align right',
    shortcut: 'mod+shift+r',
    command: SN_FORMAT_ELEMENT_COMMAND,
    category: 'align'
  },
  {
    id: 'justify',
    name: 'justify',
    shortcut: 'mod+shift+j',
    command: SN_FORMAT_ELEMENT_COMMAND,
    category: 'align'
  },

  // indentation
  {
    id: 'indent-decrease',
    name: 'decrease indent',
    shortcut: 'mod+shift+[',
    command: OUTDENT_CONTENT_COMMAND,
    category: 'indent'
  },
  {
    id: 'indent-increase',
    name: 'increase indent',
    shortcut: 'mod+shift+]',
    command: INDENT_CONTENT_COMMAND,
    category: 'indent'
  },

  // inserts
  {
    id: 'link',
    name: 'link',
    shortcut: 'mod+k',
    command: SN_TOGGLE_LINK_COMMAND,
    commandValue: '',
    category: 'insert'
  },
  {
    id: 'upload',
    name: 'upload files',
    shortcut: 'mod+shift+u',
    command: SN_UPLOAD_FILES_COMMAND,
    category: 'insert'
  },
  {
    id: 'table',
    name: 'table',
    shortcut: 'ctrl+alt+t',
    command: null, // handle separately
    category: 'insert'
  },
  {
    id: 'math',
    name: 'math',
    shortcut: 'ctrl+alt+l',
    command: SN_INSERT_MATH_COMMAND,
    category: 'insert'
  },
  {
    id: 'math-inline',
    name: 'inline math',
    shortcut: 'ctrl+l',
    command: SN_INSERT_MATH_COMMAND,
    commandValue: { inline: true },
    category: 'insert'
  },

  // editor
  {
    id: 'toggleMode',
    name: 'toggle mode',
    shortcut: 'mod+shift+m',
    command: SN_TOGGLE_MODE_COMMAND,
    category: 'editor'
  }
]

// some helpers
// wip
export const getAction = (id) => ACTIONS.find(a => a.id === id)

export const getActions = (category) => category
  ? ACTIONS.filter(a => a.category === category)
  : ACTIONS

export const getAllShortcuts = () =>
  ACTIONS.map(action => ({
    id: action.id,
    combo: action.shortcut,
    handler: ({ editor }) => {
      const commandValue = action.commandValue ?? action.id
      editor.dispatchCommand(action.command, commandValue)
    }
  }))

export const getShortcut = (id) => getAction(id)?.shortcut
