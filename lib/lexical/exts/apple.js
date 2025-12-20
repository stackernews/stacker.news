import { defineExtension, KEY_BACKSPACE_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical'
import { CAN_USE_BEFORE_INPUT, IS_IOS, IS_SAFARI, IS_APPLE_WEBKIT } from '@lexical/utils'

/**
 * Apple-related patches for Lexical
 *
 * Apple platforms update their autocorrect buffer on `beforeInput` event.
 * Lexical's KEY_BACKSPACE_COMMAND calls `preventDefault()` on keydown, which prevents
 * the native `beforeInput` event from firing.
 *
 * This extension overrides KEY_BACKSPACE_COMMAND to not `preventDefault()` on Apple platforms.
 * Fixes autocorrect, autocompletion and whole word deletion (hold backspace)
 *
 * @see https://github.com/facebook/lexical/issues/7994
 */
export const ApplePatchExtension = defineExtension({
  name: 'apple-patch',
  register: (editor) => {
    return editor.registerCommand(KEY_BACKSPACE_COMMAND, () => {
      if ((IS_IOS || IS_SAFARI || IS_APPLE_WEBKIT) && CAN_USE_BEFORE_INPUT) {
        return true
      }
      return false
    }, COMMAND_PRIORITY_HIGH)
  }
})
