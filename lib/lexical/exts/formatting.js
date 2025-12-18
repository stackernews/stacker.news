import {
  defineExtension,
  $getSelection, $isRangeSelection,
  KEY_ENTER_COMMAND, INSERT_PARAGRAPH_COMMAND, INSERT_LINE_BREAK_COMMAND,
  COMMAND_PRIORITY_HIGH, $isParagraphNode
} from 'lexical'
import { mergeRegister, IS_IOS, IS_SAFARI, IS_APPLE_WEBKIT, CAN_USE_BEFORE_INPUT } from '@lexical/utils'

export const SNFormattingExtension = defineExtension({
  name: 'sn-formatting',
  register: (editor) => {
    return mergeRegister(
      // insert paragraph on enter
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (e) => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return false

          if (e !== null) {
            // allow autocomplete to work on iOS
            // @lexical/plain-text
            if ((IS_IOS || IS_SAFARI || IS_APPLE_WEBKIT) && CAN_USE_BEFORE_INPUT) {
              return false
            }
            e.preventDefault()
          }

          const anchor = selection.anchor.getNode()
          // a blank line (linebreak) has a paragraph as anchor in plain text
          // if we're on a blank line, we can insert a paragraph
          // allowing triple click to truly select a paragraph
          if ($isParagraphNode(anchor)) {
            selection.insertParagraph()
            return true
          } else {
            return editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false)
          }
        },
        COMMAND_PRIORITY_HIGH
      ),
      // PlainTextExtension overrides this command to insert a line break
      // restore original paragraph command
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return false

          selection.insertParagraph()
          return true
        },
        COMMAND_PRIORITY_HIGH
      )
    )
  }
})
