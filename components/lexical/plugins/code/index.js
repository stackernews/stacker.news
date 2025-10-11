import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki'

export default function CodeShikiPlugin ({ isEditable = true }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return registerCodeHighlighting(editor, { ...ShikiTokenizer, defaultTheme: 'github-dark-default' })
  }, [editor])

  return null
}
