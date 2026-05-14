import { $nodesOfType, createCommand, COMMAND_PRIORITY_EDITOR, defineExtension } from 'lexical'
import { CodeExtension, CodeNode } from '@lexical/code-core'
import { ShikiTokenizer } from '@/lib/lexical/exts/shiki/tokenizer'
import { registerCodeHighlighting } from '@/lib/lexical/exts/shiki/register'

export const UPDATE_CODE_THEME_COMMAND = createCommand('UPDATE_CODE_THEME_COMMAND')

// SN-flavored tokenizer: tokenize as plain text by default (so a code block
// without an explicit language doesn't randomly pick javascript) and use
// github-dark-default as the initial theme. defaultTheme is mutated in place
// by UPDATE_CODE_THEME_COMMAND so newly created CodeNodes pick up the current
// site theme. Existing CodeNodes carry their theme on the node itself.
const tokenizer = {
  ...ShikiTokenizer,
  defaultLanguage: 'text',
  defaultTheme: 'github-dark-default'
}

export const CodeShikiSNExtension = defineExtension({
  name: 'CodeShikiSNExtension',
  // CodeExtension registers CodeNode + CodeHighlightNode and the KEY_ENTER
  // "press Enter three times to exit a code block" handler. Everything else
  // (highlight transforms, Tab handling, Alt+arrow line shift, Cmd-Home/End)
  // lives in registerCodeHighlighting below.
  dependencies: [CodeExtension],
  register: (editor) => {
    const unregister = registerCodeHighlighting(editor, tokenizer)
    const unregisterCommand = editor.registerCommand(
      UPDATE_CODE_THEME_COMMAND,
      (newTheme) => {
        // re-paint existing code blocks: setTheme marks them dirty and the
        // transform pipeline re-tokenizes against the new theme
        $nodesOfType(CodeNode).forEach(node => node.setTheme(newTheme))
        // future CodeNodes pick this up via $codeNodeTransform's defaults
        tokenizer.defaultTheme = newTheme
        return true
      },
      COMMAND_PRIORITY_EDITOR
    )
    return () => {
      unregisterCommand()
      unregister()
    }
  }
})

export { normalizeCodeLanguage, getCodeLanguageOptions, getCodeThemeOptions } from '@/lib/lexical/exts/shiki/highlighter'
