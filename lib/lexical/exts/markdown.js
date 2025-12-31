import { DragonExtension } from '@lexical/dragon'
import {
  COMMAND_PRIORITY_HIGH,
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
  CUT_COMMAND
} from 'lexical'
import { registerRichText } from '@lexical/rich-text'
import { mergeRegister, objectKlassEquals } from '@lexical/utils'

/** rich text extension that handles plain text only */
export const MarkdownTextExtension = defineExtension({
  name: 'MarkdownTextExtension',
  conflictsWith: ['@lexical/rich-text', '@lexical/plain-text'],
  dependencies: [DragonExtension], // speech to text
  register: (editor) => {
    return mergeRegister(
      registerRichText(editor),
      // block formatting and text alignment commands
      editor.registerCommand(FORMAT_TEXT_COMMAND, () => true, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(FORMAT_ELEMENT_COMMAND, () => true, COMMAND_PRIORITY_HIGH),

      // block drag drop (LexicalPlainText)
      editor.registerCommand(DROP_COMMAND, event => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false
        event.preventDefault()
        return true
      }, COMMAND_PRIORITY_HIGH),
      // block drag start (LexicalPlainText)
      editor.registerCommand(DRAGSTART_COMMAND, event => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false
        event.preventDefault()
        return true
      }, COMMAND_PRIORITY_HIGH),
      // block drag over
      editor.registerCommand(DRAGOVER_COMMAND, () => true, COMMAND_PRIORITY_HIGH),

      // intercept paste and only handle plain text
      editor.registerCommand(
        PASTE_COMMAND,
        (e) => {
          // skip if we already processed this event
          if (e.plainTextOnly) return false

          let clipboardData = null
          if (objectKlassEquals(e, window.InputEvent) || objectKlassEquals(e, window.KeyboardEvent)) {
            clipboardData = null
          } else {
            clipboardData = e.clipboardData
          }

          if (clipboardData == null) return false

          const text = clipboardData.getData('text/plain') || clipboardData.getData('text/uri-list')
          if (text != null) {
            // create new DataTransfer with only plain text
            const newDataTransfer = new window.DataTransfer()
            newDataTransfer.setData('text/plain', text)

            // create new event with plain-text-only clipboardData
            const modifiedEvent = new window.ClipboardEvent('paste', {
              clipboardData: newDataTransfer,
              bubbles: true,
              cancelable: true
            })
            // mark the event as plain text only
            // guard against infinite recursion
            modifiedEvent.plainTextOnly = true

            // dispatch the modified event to let Lexical Rich Text handle it
            editor.dispatchCommand(PASTE_COMMAND, modifiedEvent)
            return true // stop original event propagation
          }
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
        COMMAND_PRIORITY_HIGH
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
        COMMAND_PRIORITY_HIGH
      )
    )
  }
})
