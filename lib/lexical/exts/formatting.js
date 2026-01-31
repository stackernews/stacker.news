import { defineExtension } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { registerSNFormatBlockCommand } from '@/lib/lexical/commands/formatting/blocks'
import { registerSNFormatCommand } from '@/lib/lexical/commands/formatting/format'
import { registerSNToggleLinkCommand } from '@/lib/lexical/commands/links'
import { registerMDFormatCommand } from '@/lib/lexical/commands/formatting/markdown'

export const FormattingCommandsExtension = defineExtension({
  name: 'FormattingCommandsExtension',
  register: (editor) => {
    return mergeRegister(
      // direct markdown commands
      registerMDFormatCommand(editor),
      // universal formatting commands with transformer bridge support
      registerSNFormatCommand(editor),
      registerSNFormatBlockCommand(editor),
      registerSNToggleLinkCommand(editor)
    )
  }
})
