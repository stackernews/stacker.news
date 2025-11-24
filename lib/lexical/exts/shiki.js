import { $getRoot } from 'lexical'
import { defineExtension } from '@lexical/extension'
import { registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki'
import { CodeExtension, $isCodeNode } from '@lexical/code'

export const CodeShikiSNExtension = defineExtension({
  name: 'CodeShikiSNExtension',
  config: { tokenizer: { ...ShikiTokenizer, defaultLanguage: 'text', defaultTheme: 'github-dark-default' } },
  dependencies: [CodeExtension],
  register: (editor, { tokenizer }) => {
    const cleanup = registerCodeHighlighting(editor, tokenizer)

    editor._updateCodeTheme = (newTheme) => {
      // remove previous registration
      cleanup()
      // set theme on all code nodes
      editor.update(() => {
        const root = $getRoot()

        root.getChildren().forEach(child => {
          if ($isCodeNode(child)) {
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
