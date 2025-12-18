import { $nodesOfType, createCommand, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { defineExtension } from '@lexical/extension'
import { registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki'
import { CodeExtension, CodeNode } from '@lexical/code'

export const UPDATE_CODE_THEME_COMMAND = createCommand()

export const CodeShikiSNExtension = defineExtension({
  name: 'CodeShikiSNExtension',
  config: { tokenizer: { ...ShikiTokenizer, defaultLanguage: 'text', defaultTheme: 'github-dark-default' } },
  dependencies: [CodeExtension],
  register: (editor, { tokenizer }) => {
    let cleanup = registerCodeHighlighting(editor, tokenizer)

    const unregister = editor.registerCommand(
      UPDATE_CODE_THEME_COMMAND,
      (newTheme) => {
        // remove previous registration
        cleanup()
        // set theme on all code nodes
        $nodesOfType(CodeNode).forEach(node => node.setTheme(newTheme))

        cleanup = registerCodeHighlighting(editor, { ...tokenizer, defaultTheme: newTheme })
        return true
      }, COMMAND_PRIORITY_EDITOR)

    return () => {
      unregister()
      cleanup()
    }
  }
})
