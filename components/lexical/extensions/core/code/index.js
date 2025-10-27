import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { $getRoot } from 'lexical'
import { defineExtension } from '@lexical/extension'
import { registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki'
import useDarkMode from '@/components/dark-mode'
import { CodeExtension, $isCodeNode, CodeNode } from '@lexical/code'
import { $isMarkdownNode, MarkdownNode } from '@/lib/lexical/nodes/core/markdown'

export const CodeShikiSNExtension = defineExtension({
  name: 'CodeShikiSNExtension',
  config: { tokenizer: { ...ShikiTokenizer, defaultLanguage: 'text', defaultTheme: 'github-dark-default' } },
  dependencies: [CodeExtension],
  register: (editor, { tokenizer }) => {
    let shikiCodeNodeTransform = null
    const originalRegister = editor.registerNodeTransform

    // klass is lexical's node class
    editor.registerNodeTransform = function (klass, transform) {
      if (klass === CodeNode) {
        shikiCodeNodeTransform = transform
      }
      // call the original register function
      return originalRegister.call(this, klass, transform)
    }

    const cleanup = registerCodeHighlighting(editor, tokenizer)

    // restore original node transform register
    editor.registerNodeTransform = originalRegister

    // register also for MarkdownNode
    const markdownCleanup = editor.registerNodeTransform(MarkdownNode, shikiCodeNodeTransform)

    editor._updateCodeTheme = (newTheme) => {
      // remove previous registration
      cleanup()
      // set theme on all code and markdown nodes
      editor.update(() => {
        const root = $getRoot()

        root.getChildren().forEach(child => {
          if ($isMarkdownNode(child)) {
            child.setLanguage('markdown')
            child.setTheme(newTheme)
          }
          if ($isCodeNode(child)) {
            child.setTheme(newTheme)
          }
        })
      })

      return registerCodeHighlighting(editor, { ...tokenizer, defaultTheme: newTheme })
    }

    return () => {
      cleanup()
      markdownCleanup()
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
