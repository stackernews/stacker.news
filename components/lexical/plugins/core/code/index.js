import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { $getRoot } from 'lexical'
import { defineExtension } from '@lexical/extension'
import { registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki'
import useDarkMode from '@/components/dark-mode'
import { CodeExtension, $isCodeNode } from '@lexical/code'
import { $isMarkdownNode } from '@/lib/lexical/nodes/core/markdown'

export const CodeShikiSNExtension = defineExtension({
  name: 'CodeShikiSNExtension',
  config: { tokenizer: { ...ShikiTokenizer, defaultTheme: 'github-dark-default' } },
  dependencies: [CodeExtension],
  register: (editor, { tokenizer }) => {
    const cleanup = registerCodeHighlighting(editor, tokenizer)
    editor._updateCodeTheme = (newTheme) => {
      // remove previous registration
      cleanup()
      // set theme on all code and markdown nodes
      editor.update(() => {
        const root = $getRoot()

        root.getChildren().forEach(child => {
          if ($isCodeNode(child) || $isMarkdownNode(child)) {
            child.setTheme(newTheme)
          }
        })
      })

      return registerCodeHighlighting(editor, { ...tokenizer, defaultTheme: newTheme })
    }

    return () => {
      cleanup()
      editor._updateCodeTheme = null
    }
  }
})

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
