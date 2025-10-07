import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import { snFormatTextCommand, snFormatBlockCommand } from './formatting'
import { snToggleLinkCommand } from './links'

export default function UniversalCommandsPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      snFormatTextCommand({ editor }),
      snFormatBlockCommand({ editor }),
      snToggleLinkCommand({ editor })
    )
  }, [editor])

  return null
}
