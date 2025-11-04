import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import useDarkMode from '@/components/dark-mode'

export function CodeThemePlugin () {
  const [editor] = useLexicalComposerContext()
  const [darkMode] = useDarkMode()

  const theme = darkMode ? 'github-dark-default' : 'github-light-default'

  useEffect(() => {
    if (!editor._updateCodeTheme) return
    return editor._updateCodeTheme(theme)
  }, [darkMode, theme])

  return null
}
