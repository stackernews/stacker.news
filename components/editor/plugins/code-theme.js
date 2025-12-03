import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import useDarkMode from '@/components/dark-mode'
import { UPDATE_CODE_THEME_COMMAND } from '@/lib/lexical/exts/shiki'

/** syncs code block syntax highlighting theme with site dark mode */
export function CodeThemePlugin () {
  const [editor] = useLexicalComposerContext()
  const [darkMode] = useDarkMode()

  const theme = darkMode ? 'github-dark-default' : 'github-light-default'

  useEffect(() => {
    return editor.dispatchCommand(UPDATE_CODE_THEME_COMMAND, theme)
  }, [editor, darkMode, theme])

  return null
}
