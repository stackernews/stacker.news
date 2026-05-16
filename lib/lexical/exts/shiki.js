import { $nodesOfType, createCommand, COMMAND_PRIORITY_EDITOR, defineExtension, configExtension } from 'lexical'
import { CodeShikiExtension, ShikiTokenizer } from '@lexical/code-shiki'
import { CodeNode } from '@lexical/code-core'
import { getExtensionDependencyFromEditor } from '@lexical/extension'

export const UPDATE_CODE_THEME_COMMAND = createCommand('UPDATE_CODE_THEME_COMMAND')

const SN_SHIKI_TOKENIZER = {
  ...ShikiTokenizer,
  defaultLanguage: 'text',
  defaultTheme: 'github-dark-default'
}

export const CodeShikiSNExtension = defineExtension({
  name: 'CodeShikiSNExtension',
  // CodeShikiExtension auto-pulls CodeExtension + CodeIndentExtension,
  // which is where the 0.44 KEY_ENTER_COMMAND escape logic lives
  dependencies: [
    configExtension(CodeShikiExtension, { tokenizer: SN_SHIKI_TOKENIZER })
  ],
  register: (editor) => {
    const shikiOutput = getExtensionDependencyFromEditor(editor, CodeShikiExtension).output
    return editor.registerCommand(
      UPDATE_CODE_THEME_COMMAND,
      (newTheme) => {
        // CodeNodes store their own theme; updating them marks them dirty so
        // the highlight transform repaints with the new theme
        $nodesOfType(CodeNode).forEach(node => node.setTheme(newTheme))
        // swap the tokenizer signal so any new CodeNode picks up the new defaultTheme
        shikiOutput.tokenizer.value = { ...SN_SHIKI_TOKENIZER, defaultTheme: newTheme }
        return true
      },
      COMMAND_PRIORITY_EDITOR
    )
  }
})
