import { defineExtension, KEY_BACKSPACE_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical'
import { CAN_USE_BEFORE_INPUT } from '@lexical/utils'

/**
 * On keyboards that can compose text, `beforeInput` is used to manage autocorrect, autocompletion, delete, etc.
 * Lexical's KEY_BACKSPACE_COMMAND calls `preventDefault()` on keydown, which prevents
 * the native `beforeInput` event from firing.
 *
 * This extension overrides KEY_BACKSPACE_COMMAND to not `preventDefault()` when `beforeInput` is available.
 * Fixes autocorrect, autocompletion and delete
 *
 * @see https://github.com/facebook/lexical/issues/7994
 */
export const LexicalPatchExtension = defineExtension({
  name: 'lexical-patch',
  register: (editor) => {
    return editor.registerCommand(KEY_BACKSPACE_COMMAND, () => {
      if (CAN_USE_BEFORE_INPUT) {
        return true
      }
      return false
    }, COMMAND_PRIORITY_HIGH)
  }
})
