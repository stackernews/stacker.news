import { defineExtension, COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND } from 'lexical'
import { MD_FORMAT_COMMAND, MD_INSERT_BLOCK_COMMAND, MDCommandsExtension } from './md-commands'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/editor/plugins/upload'
import { TOGGLE_PREVIEW_COMMAND } from '@/components/editor/plugins/preview'
import { SUBMIT_FORMIK_COMMAND } from '@/components/editor/plugins/core/formik'

export const SHORTCUTS = {
  link: { // link
    id: 'link',
    key: 'meta+k',
    handler: (editor) => editor.dispatchCommand(MD_FORMAT_COMMAND, 'link')
  },
  bold: { // bold
    id: 'bold',
    key: 'meta+b',
    handler: (editor) => editor.dispatchCommand(MD_FORMAT_COMMAND, 'bold')
  },
  italic: { // italic
    id: 'italic',
    key: 'meta+i',
    handler: (editor) => editor.dispatchCommand(MD_FORMAT_COMMAND, 'italic')
  },
  quote: { // quote
    id: 'quote',
    key: 'meta+shift+.',
    handler: (editor) => editor.dispatchCommand(MD_FORMAT_COMMAND, 'quote')
  },
  inlineCode: { // code
    id: 'inlineCode',
    key: 'meta+e',
    handler: (editor) => editor.dispatchCommand(MD_FORMAT_COMMAND, 'code')
  },
  superscript: { // superscript
    id: 'superscript',
    key: 'meta+.',
    handler: (editor) => editor.dispatchCommand(MD_FORMAT_COMMAND, 'superscript')
  },
  subscript: { // subscript
    id: 'subscript',
    key: 'meta+,',
    handler: (editor) => editor.dispatchCommand(MD_FORMAT_COMMAND, 'subscript')
  },
  strikethrough: { // strikethrough
    id: 'strikethrough',
    key: 'meta+shift+x',
    handler: (editor) => editor.dispatchCommand(MD_FORMAT_COMMAND, 'strikethrough')
  },
  h1: { // heading 1
    id: 'h1',
    key: 'meta+shift+1',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BLOCK_COMMAND, { type: 'heading', payload: 1 })
  },
  h2: { // heading 2
    id: 'h2',
    key: 'meta+shift+2',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BLOCK_COMMAND, { type: 'heading', payload: 2 })
  },
  h3: { // heading 3
    id: 'h3',
    key: 'meta+shift+3',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BLOCK_COMMAND, { type: 'heading', payload: 3 })
  },
  numberedList: { // numbered list
    id: 'numberedList',
    key: 'meta+shift+7',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BLOCK_COMMAND, { type: 'list', payload: 'number' })
  },
  bulletList: { // bullet list
    id: 'bulletList',
    key: 'meta+shift+8',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BLOCK_COMMAND, { type: 'list', payload: 'bullet' })
  },
  check: { // check list
    id: 'check',
    key: 'meta+shift+9',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BLOCK_COMMAND, { type: 'list', payload: 'check' })
  },
  codeblock: { // code block
    id: 'codeblock',
    key: 'meta+shift+c',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BLOCK_COMMAND, { type: 'codeblock', payload: 'text' })
  },
  externalImage: { // external image
    id: 'externalImage',
    key: 'meta+shift+i',
    handler: (editor) => editor.dispatchCommand(MD_INSERT_BLOCK_COMMAND, { type: 'externalImage' })
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

          const parts = key.toLowerCase().split('+')
          const needsMeta = parts.includes('meta')
          const needsShift = parts.includes('shift')
          const targetKey = parts[parts.length - 1]

          const metaOrCtrl = e.metaKey || e.ctrlKey
          const hasShift = e.shiftKey

          if (needsMeta && !metaOrCtrl) continue
          if (needsShift !== hasShift) continue

          if (e.key.toLowerCase() === targetKey) {
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
