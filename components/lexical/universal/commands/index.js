import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import { registerSNFormatTextCommand } from './formatting/inline'
import { registerSNFormatElementCommand } from './formatting/elements'
import { registerSNFormatBlockCommand } from './formatting/blocks'
import { registerSNToggleLinkCommand } from './links'

export default function UniversalCommandsPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      registerSNFormatTextCommand({ editor }),
      registerSNFormatBlockCommand({ editor }),
      registerSNFormatElementCommand({ editor }),
      registerSNToggleLinkCommand({ editor })
    )
  }, [editor])

  return null
}
