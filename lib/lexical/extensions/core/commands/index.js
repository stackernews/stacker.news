import { mergeRegister } from '@lexical/utils'
import { registerSNFormatTextCommand } from '@/lib/lexical/universal/commands/formatting/inline'
import { registerSNFormatElementCommand } from '@/lib/lexical/universal/commands/formatting/elements'
import { registerSNFormatBlockCommand } from '@/lib/lexical/universal/commands/formatting/blocks'
import { registerSNToggleLinkCommand } from '@/lib/lexical/universal/commands/links'
import { registerSNInsertMathCommand } from '@/lib/lexical/universal/commands/math'
import { defineExtension } from '@lexical/extension'
import { registerSNInsertTableCommand, registerSNTableDeleteCommand, registerSNTableInsertCommand, registerSNTableMergeToggleCommand, registerSNTableHeaderToggleCommand } from '@/lib/lexical/universal/commands/table'

export const SNCommandsExtension = defineExtension({
  name: 'UniversalCommandsExtension',
  register: (editor) => {
    return mergeRegister(
      registerSNFormatTextCommand({ editor }),
      registerSNFormatBlockCommand({ editor }),
      registerSNFormatElementCommand({ editor }),
      registerSNToggleLinkCommand({ editor }),
      registerSNInsertMathCommand({ editor }),
      registerSNInsertTableCommand({ editor }),
      registerSNTableDeleteCommand({ editor }),
      registerSNTableInsertCommand({ editor }),
      registerSNTableMergeToggleCommand({ editor }),
      registerSNTableHeaderToggleCommand({ editor })
    )
  }
})
