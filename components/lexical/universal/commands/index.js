import { mergeRegister } from '@lexical/utils'
import { registerSNFormatTextCommand } from './formatting/inline'
import { registerSNFormatElementCommand } from './formatting/elements'
import { registerSNFormatBlockCommand } from './formatting/blocks'
import { registerSNToggleLinkCommand } from './links'
import { registerSNInsertMathCommand } from './math'
import { defineExtension } from '@lexical/extension'

export const UniversalCommandsExtension = defineExtension({
  name: 'UniversalCommandsExtension',
  register: (editor) => {
    return mergeRegister(
      registerSNFormatTextCommand({ editor }),
      registerSNFormatBlockCommand({ editor }),
      registerSNFormatElementCommand({ editor }),
      registerSNToggleLinkCommand({ editor }),
      registerSNInsertMathCommand({ editor })
    )
  }
})
