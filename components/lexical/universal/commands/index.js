import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import { registerSNFormatTextCommand } from './formatting/inline'
import { registerSNFormatElementCommand } from './formatting/elements'
import { registerSNFormatBlockCommand } from './formatting/blocks'
import { registerSNToggleLinkCommand } from './links'
import { registerSNToggleModeCommand } from './mode'
import { registerSNInsertMathCommand } from './math'
import { registerSNTableCommands } from './table'

export default function UniversalCommandsPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      registerSNFormatTextCommand({ editor }),
      registerSNFormatBlockCommand({ editor }),
      registerSNFormatElementCommand({ editor }),
      registerSNToggleLinkCommand({ editor }),
      registerSNToggleModeCommand({ editor }),
      registerSNInsertMathCommand({ editor }),
      registerSNTableCommands({ editor })
    )
  }, [editor])

  return null
}
