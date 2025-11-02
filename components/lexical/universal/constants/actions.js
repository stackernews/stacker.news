/**
 * lexical action registry
 *
 * possible properties:
 * - id: unique identifier
 * - name: ui name
 * - shortcut: bare keyboard combo (should use getShortcutCombo from shortcuts/keyboard.js)
 * - command: lexical command to dispatch
 * - commandValue: value to pass to command (defaults to id)
 * - category: defines behavior/state tracking
 * - lookup: property name in toolbar state for checking if active (e.g. toolbarState.isBold)
 * - toolbarSection: where this action appears in the toolbar UI
 *   - 'main': main toolbar buttons
 *   - 'additional': additional formatting dropdown
 *   - 'block-dropdown': block type dropdown
 *   - 'align-dropdown': alignment dropdown
 *   - 'insert-dropdown': insert tools dropdown
 *   - null: not shown in toolbar
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
    lookup: 'isBold',
    shortcut: 'mod+b',
    command: SN_FORMAT_TEXT_COMMAND,
    category: 'inline',
    toolbarSection: 'main'
  },
  {
    id: 'italic',
    name: 'italic',
    lookup: 'isItalic',
    shortcut: 'mod+i',
    command: SN_FORMAT_TEXT_COMMAND,
    category: 'inline',
    toolbarSection: 'main'
  },
  {
    id: 'quote',
    name: 'quote',
    shortcut: 'mod+alt+q',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block',
    toolbarSection: 'main'
  },
  {
    id: 'code',
    name: 'inline code',
    lookup: 'isCode',
    shortcut: 'mod+shift+i',
    command: SN_FORMAT_TEXT_COMMAND,
    category: 'inline',
    toolbarSection: 'main'
  },
  {
    id: 'underline',
    name: 'underline',
    lookup: 'isUnderline',
    shortcut: 'mod+u',
    command: SN_FORMAT_TEXT_COMMAND,
    category: 'inline',
    toolbarSection: 'additional'
  },
  {
    id: 'strikethrough',
    name: 'strikethrough',
    lookup: 'isStrikethrough',
    shortcut: 'mod+shift+x',
    command: SN_FORMAT_TEXT_COMMAND,
    category: 'inline',
    toolbarSection: 'additional'
  },

  // block formatting
  {
    id: 'paragraph',
    name: 'paragraph',
    shortcut: 'mod+alt+0',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block',
    toolbarSection: 'block-dropdown'
  },
  {
    id: 'h1',
    name: 'heading 1',
    shortcut: 'mod+alt+1',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block',
    toolbarSection: 'block-dropdown'
  },
  {
    id: 'h2',
    name: 'heading 2',
    shortcut: 'mod+alt+2',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block',
    toolbarSection: 'block-dropdown'
  },
  {
    id: 'h3',
    name: 'heading 3',
    shortcut: 'mod+alt+3',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block',
    toolbarSection: 'block-dropdown'
  },
  {
    id: 'number',
    name: 'numbered list',
    shortcut: 'mod+shift+7',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block',
    toolbarSection: 'block-dropdown'
  },
  {
    id: 'bullet',
    name: 'bullet list',
    shortcut: 'mod+shift+8',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block',
    toolbarSection: 'block-dropdown'
  },
  {
    id: 'check',
    name: 'check list',
    shortcut: 'mod+shift+9',
    command: SN_FORMAT_BLOCK_COMMAND,
    category: 'block',
    toolbarSection: 'block-dropdown'
  },
  {
    id: 'code-block',
    name: 'code block',
    shortcut: 'mod+shift+c',
    command: SN_FORMAT_BLOCK_COMMAND,
    commandValue: 'code', // maps to 'code' in switch statement
    category: 'block',
    toolbarSection: 'block-dropdown'
  },

  // alignment
  {
    id: 'left',
    name: 'align left',
    shortcut: 'mod+shift+s',
    command: SN_FORMAT_ELEMENT_COMMAND,
    category: 'align',
    toolbarSection: 'align-dropdown'
  },
  {
    id: 'center',
    name: 'center',
    shortcut: 'mod+shift+e',
    command: SN_FORMAT_ELEMENT_COMMAND,
    category: 'align',
    toolbarSection: 'align-dropdown'
  },
  {
    id: 'right',
    name: 'align right',
    shortcut: 'mod+shift+r',
    command: SN_FORMAT_ELEMENT_COMMAND,
    category: 'align',
    toolbarSection: 'align-dropdown'
  },
  {
    id: 'justify',
    name: 'justify',
    shortcut: 'mod+shift+j',
    command: SN_FORMAT_ELEMENT_COMMAND,
    category: 'align',
    toolbarSection: 'align-dropdown'
  },

  // indentation
  {
    id: 'indent-decrease',
    name: 'decrease indent',
    shortcut: 'mod+shift+[',
    command: OUTDENT_CONTENT_COMMAND,
    category: 'indent',
    toolbarSection: 'align-dropdown'
  },
  {
    id: 'indent-increase',
    name: 'increase indent',
    shortcut: 'mod+shift+]',
    command: INDENT_CONTENT_COMMAND,
    category: 'indent',
    toolbarSection: 'align-dropdown'
  },

  // inserts
  {
    id: 'link',
    name: 'link',
    lookup: 'isLink',
    shortcut: 'mod+k',
    command: SN_TOGGLE_LINK_COMMAND,
    commandValue: '',
    category: 'insert',
    toolbarSection: 'main'
  },
  {
    id: 'upload',
    name: 'upload files',
    shortcut: 'mod+shift+u',
    command: SN_UPLOAD_FILES_COMMAND,
    category: 'insert',
    toolbarSection: null // handled separately
  },
  {
    id: 'table',
    name: 'table',
    shortcut: 'ctrl+alt+t',
    command: null, // handle separately
    category: 'insert',
    toolbarSection: 'insert-dropdown'
  },
  {
    id: 'math',
    name: 'math',
    shortcut: 'ctrl+alt+s',
    command: SN_INSERT_MATH_COMMAND,
    category: 'insert',
    toolbarSection: 'insert-dropdown'
  },
  {
    id: 'math-inline',
    name: 'inline math',
    shortcut: 'ctrl+s',
    command: SN_INSERT_MATH_COMMAND,
    commandValue: { inline: true },
    category: 'insert',
    toolbarSection: 'insert-dropdown'
  },

  // editor
  {
    id: 'toggleMode',
    name: 'toggle mode',
    shortcut: 'mod+shift+m',
    command: SN_TOGGLE_MODE_COMMAND,
    category: 'editor',
    toolbarSection: null // not in toolbar
  }
]

// some helpers
// wip
export const getAction = (id) => ACTIONS.find(a => a.id === id)

export const getActionsByToolbarSection = (section) => section
  ? ACTIONS.filter(a => a.toolbarSection === section)
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
