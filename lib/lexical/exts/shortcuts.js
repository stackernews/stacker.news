import { defineExtension, COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND } from 'lexical'
import { MD_INSERT_LINK_COMMAND, MD_INSERT_BOLD_COMMAND, MD_INSERT_ITALIC_COMMAND, MD_INSERT_QUOTE_COMMAND, MD_INSERT_CODE_COMMAND, MD_INSERT_SUPERSCRIPT_COMMAND, MD_INSERT_SUBSCRIPT_COMMAND, MD_INSERT_STRIKETHROUGH_COMMAND, MDCommandsExtension } from './md-commands'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/editor/plugins/upload'
import { TOGGLE_PREVIEW_COMMAND } from '@/components/editor/plugins/preview'
import { SUBMIT_FORMIK_COMMAND } from '@/components/editor/plugins/core/formik'

export const SHORTCUTS = {
  link: { // link
    id: 'link',
    key: 'meta+k',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_LINK_COMMAND, editor)
  },
  bold: { // bold
    id: 'bold',
    key: 'meta+b',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BOLD_COMMAND, editor)
  },
  italic: { // italic
    id: 'italic',
    key: 'meta+i',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_ITALIC_COMMAND, editor)
  },
  quote: { // quote
    id: 'quote',
    key: 'meta+q',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_QUOTE_COMMAND, editor)
  },
  inlineCode: { // code
    id: 'inlineCode',
    key: 'meta+j',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_CODE_COMMAND, editor)
  },
  superscript: { // superscript
    id: 'superscript',
    key: 'meta+s',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_SUPERSCRIPT_COMMAND, editor)
  },
  subscript: { // subscript
    id: 'subscript',
    key: 'meta+x',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_SUBSCRIPT_COMMAND, editor)
  },
  strikethrough: { // strikethrough
    id: 'strikethrough',
    key: 'meta+t',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_STRIKETHROUGH_COMMAND, editor)
  },
  upload: { // upload files
    id: 'upload',
    key: 'meta+u',
    handler: (editor) => editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)
  },
  preview: { // toggle preview
    id: 'preview',
    key: 'meta+p',
    handler: (editor) => editor.dispatchCommand(TOGGLE_PREVIEW_COMMAND, editor)
  },
  submit: { // submit formik form
    id: 'submit',
    key: 'meta+enter',
    handler: (editor) => editor.dispatchCommand(SUBMIT_FORMIK_COMMAND)
  }
}

export const ShortcutsExtension = defineExtension({
  name: 'ShortcutsExtension',
  config: { shortcuts: SHORTCUTS },
  register: (editor, { shortcuts }) => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (e) => {
        for (const shortcut of Object.values(shortcuts)) {
          const { key, handler } = shortcut
          if (!key) continue
          const metaOrCtrl = e.metaKey || e.ctrlKey
          if (metaOrCtrl && e.key.toLowerCase() === key.split('+')[1].toLowerCase()) {
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
