import { $nodesOfType } from 'lexical'
import { defineExtension } from '@lexical/extension'
import { registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki'
import { CodeExtension, CodeNode } from '@lexical/code'

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
        $nodesOfType(CodeNode).forEach(node => node.setTheme(newTheme))
      })

      return registerCodeHighlighting(editor, { ...tokenizer, defaultTheme: newTheme })
    }

    return () => {
      cleanup()
      editor._updateCodeTheme = null
    }
  }
})
