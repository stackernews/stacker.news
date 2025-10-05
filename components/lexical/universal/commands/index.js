import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import { snFormatTextCommand } from './formatting'
import { snToggleLinkCommand } from './links'

export default function UniversalCommandsPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const unregister = mergeRegister(
      snFormatTextCommand({ editor }),
      snToggleLinkCommand({ editor })
    )
    return () => {
      unregister()
    }
  }, [editor])

  return null
}
