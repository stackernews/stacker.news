import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { registerCodeHighlighting, getCodeThemeOptions } from '@lexical/code-shiki'

export default function CodeShikiPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    console.log(getCodeThemeOptions())
    return registerCodeHighlighting(editor)
  }, [editor])

  return null
}
