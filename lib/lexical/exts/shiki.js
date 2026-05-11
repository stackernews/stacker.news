import { $nodesOfType, createCommand, COMMAND_PRIORITY_EDITOR, defineExtension } from 'lexical'
import { CodeExtension, CodeNode, PrismTokenizer, registerCodeHighlighting } from '@lexical/code'

export const UPDATE_CODE_THEME_COMMAND = createCommand()

export const CodeShikiSNExtension = defineExtension({
  name: 'CodeShikiSNExtension',
  config: { tokenizer: { ...PrismTokenizer, defaultLanguage: 'text' } },
  dependencies: [CodeExtension],
  register: (editor, { tokenizer }) => {
    let cleanup = registerCodeHighlighting(editor, tokenizer)

    const unregister = editor.registerCommand(
      UPDATE_CODE_THEME_COMMAND,
      (newTheme) => {
        // remove previous registration
        // set theme on all code nodes
        $nodesOfType(CodeNode).forEach(node => node.setTheme(newTheme))

        cleanup()
        cleanup = registerCodeHighlighting(editor, tokenizer)
        return true
      }, COMMAND_PRIORITY_EDITOR)

    return () => {
      unregister()
      cleanup()
    }
  }
})
