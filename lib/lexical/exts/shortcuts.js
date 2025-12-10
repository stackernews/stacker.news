import { defineExtension, COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND } from 'lexical'
import { MD_INSERT_LINK_COMMAND, MD_INSERT_BOLD_COMMAND, MD_INSERT_ITALIC_COMMAND, MDCommandsExtension } from './md-commands'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/editor/plugins/upload'
import { TOGGLE_PREVIEW_COMMAND } from '@/components/editor/plugins/preview'
import { SUBMIT_FORMIK_COMMAND } from '@/components/editor/plugins/core/formik'

export const SHORTCUTS = [
  { // link
    combo: 'meta+k',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_LINK_COMMAND, editor)
  },
  { // bold
    combo: 'meta+b',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BOLD_COMMAND, editor)
  },
  { // italic
    combo: 'meta+i',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_ITALIC_COMMAND, editor)
  },
  { // upload files
    combo: 'meta+u',
    handler: (editor) => editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)
  },
  { // toggle preview
    combo: 'meta+p',
    handler: (editor) => editor.dispatchCommand(TOGGLE_PREVIEW_COMMAND, editor)
  },
  { // submit formik form
    combo: 'meta+enter',
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
        for (const { combo, handler } of shortcuts) {
          if (!combo) continue
          // only the already known shortcuts in stage 1
          if (e.metaKey && e.key.toLowerCase() === combo.split('+')[1].toLowerCase()) {
            e.preventDefault()
            handler(editor)
            return true
          }
        }
        return false
      },
      COMMAND_PRIORITY_HIGH
    )
  },
  dependencies: [MDCommandsExtension]
})
