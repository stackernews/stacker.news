import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki'
import useDarkMode from '@/components/dark-mode'

export default function CodeShikiPlugin ({ isEditable = true }) {
  const [editor] = useLexicalComposerContext()
  const [darkMode] = useDarkMode()
  const theme = darkMode ? 'github-dark-default' : 'github-light-default'

  useEffect(() => {
    return registerCodeHighlighting(editor, { ...ShikiTokenizer, defaultTheme: theme })
  }, [editor, theme])

  return null
}
