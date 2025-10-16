import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki'
import useDarkMode from '@/components/dark-mode'
import { $getRoot } from 'lexical'
import { $isMarkdownNode } from '@/lib/lexical/nodes/markdownnode'

export default function CodeShikiPlugin () {
  const [editor] = useLexicalComposerContext()
  const [darkMode] = useDarkMode()

  const theme = darkMode ? 'github-dark-default' : 'github-light-default'

  useEffect(() => {
    editor.update(() => {
      const root = $getRoot()
      const firstChild = root.getFirstChild()
      if ($isMarkdownNode(firstChild)) {
        firstChild.setTheme(theme)
      }
    })
  }, [darkMode, theme])

  useEffect(() => {
    return registerCodeHighlighting(editor, { ...ShikiTokenizer, defaultTheme: theme })
  }, [editor, darkMode, theme])

  return null
}
