import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import { registerSNFormatTextCommand, registerSNFormatBlockCommand } from './formatting'
import { registerSNToggleLinkCommand } from './links'

export default function UniversalCommandsPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      registerSNFormatTextCommand({ editor }),
      registerSNFormatBlockCommand({ editor }),
      registerSNToggleLinkCommand({ editor })
    )
  }, [editor])

  return null
}
