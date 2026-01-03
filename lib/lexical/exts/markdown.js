import { DragonExtension } from '@lexical/dragon'
import {
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_NORMAL,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  DRAGOVER_COMMAND,
  defineExtension,
  $getSelection,
  $isRangeSelection,
  PASTE_COMMAND,
  COPY_COMMAND,
  CUT_COMMAND,
  PASTE_TAG
} from 'lexical'
import { registerRichText } from '@lexical/rich-text'
import { mergeRegister, objectKlassEquals } from '@lexical/utils'
import { $insertMarkdown } from '@/lib/lexical/utils'

function onPasteForMarkdown (event, editor) {
  event.preventDefault()
  editor.update(() => {
    const selection = $getSelection()
    // anything else is managed by other Lexical commands
    const clipboardData = objectKlassEquals(event, window.ClipboardEvent) ? event.clipboardData : null
    if (clipboardData != null && selection !== null) {
      // we'll just get the plain text data from the clipboard
      const text = clipboardData.getData('text/plain') || clipboardData.getData('text/uri-list')
      if (text != null) {
        $insertMarkdown(text)
      }
    }
  }, { tag: PASTE_TAG })
}

/** rich text extension that handles plain text only */
export const MarkdownTextExtension = defineExtension({
  name: 'MarkdownTextExtension',
  conflictsWith: ['@lexical/rich-text', '@lexical/plain-text'],
  dependencies: [DragonExtension], // speech to text
  register: (editor) => {
    return mergeRegister(
      registerRichText(editor),
      // block formatting and text alignment commands
      editor.registerCommand(FORMAT_TEXT_COMMAND, () => true, COMMAND_PRIORITY_CRITICAL),
      editor.registerCommand(FORMAT_ELEMENT_COMMAND, () => true, COMMAND_PRIORITY_CRITICAL),

      // block drag drop (LexicalPlainText)
      editor.registerCommand(DROP_COMMAND, event => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false
        event.preventDefault()
        return true
      }, COMMAND_PRIORITY_NORMAL),
      // block drag start (LexicalPlainText)
      editor.registerCommand(DRAGSTART_COMMAND, event => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false
        event.preventDefault()
        return true
      }, COMMAND_PRIORITY_NORMAL),
      // block drag over
      editor.registerCommand(DRAGOVER_COMMAND, () => true, COMMAND_PRIORITY_NORMAL),

      // intercept paste and only handle plain text
      editor.registerCommand(
        PASTE_COMMAND,
        (e) => {
          const selection = $getSelection()
          if (selection !== null) {
            onPasteForMarkdown(e, editor)
            return true
          }
          return false
        },
        COMMAND_PRIORITY_NORMAL
      ),
      // copy as plain text only
      editor.registerCommand(
        COPY_COMMAND,
        (e) => {
          if (objectKlassEquals(e, window.ClipboardEvent) && e.clipboardData) {
            const selection = $getSelection()
            if (!$isRangeSelection(selection)) return false

            e.preventDefault()
            const text = selection.getTextContent()
            e.clipboardData.setData('text/plain', text)
            return true
          }

          return false
        },
        COMMAND_PRIORITY_NORMAL
      ),
      // cut as plain text only
      editor.registerCommand(
        CUT_COMMAND,
        (e) => {
          if (objectKlassEquals(e, window.ClipboardEvent) && e.clipboardData) {
            const selection = $getSelection()
            if (!$isRangeSelection(selection)) return false

            e.preventDefault()
            const text = selection.getTextContent()
            e.clipboardData.setData('text/plain', text)
            selection.removeText()
            return true
          }

          return false
        },
        COMMAND_PRIORITY_NORMAL
      )
    )
  }
})
