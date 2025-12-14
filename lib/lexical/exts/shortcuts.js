import { defineExtension, COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND } from 'lexical'
import { MD_INSERT_LINK_COMMAND, MD_INSERT_BOLD_COMMAND, MD_INSERT_ITALIC_COMMAND, MDCommandsExtension } from './md-commands'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/editor/plugins/upload'
import { TOGGLE_PREVIEW_COMMAND } from '@/components/editor/plugins/preview'
import { SUBMIT_FORMIK_COMMAND } from '@/components/editor/plugins/core/formik'

export const SHORTCUTS = [
  { // link
    key: 'k',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_LINK_COMMAND, editor)
  },
  { // bold
    key: 'b',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BOLD_COMMAND, editor)
  },
  { // italic
    key: 'i',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_ITALIC_COMMAND, editor)
  },
  { // upload files
    key: 'u',
    handler: (editor) => editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)
  },
  { // toggle preview
    key: 'p',
    handler: (editor) => editor.dispatchCommand(TOGGLE_PREVIEW_COMMAND, editor)
  },
  { // submit formik form
    key: 'enter',
    handler: (editor) => editor.dispatchCommand(SUBMIT_FORMIK_COMMAND)
  }
]

export const ShortcutsExtension = defineExtension({
  name: 'ShortcutsExtension',
  config: { shortcuts: SHORTCUTS },
  register: (editor, { shortcuts }) => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (e) => {
        for (const { key, handler } of shortcuts) {
          if (!key) continue
          const metaOrCtrl = e.metaKey || e.ctrlKey
          if (metaOrCtrl && e.key.toLowerCase() === key.toLowerCase()) {
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
  },
  dependencies: [MDCommandsExtension]
})
