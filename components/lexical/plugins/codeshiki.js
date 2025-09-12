import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki'

const shikiTokenizer = {
  ...ShikiTokenizer,
  defaultTheme: 'github-dark-default'
}

export default function CodeShikiPlugin ({ isEditable = true }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return registerCodeHighlighting(editor, shikiTokenizer)
  }, [editor])

  return null
}
