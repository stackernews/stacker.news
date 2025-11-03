import { CodeShikiSNExtension } from '@/components/lexical/extensions/core/code'
import { defineExtension } from '@lexical/extension'
import { createCommand, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { $toggleMarkdownMode } from '@/components/lexical/universal/utils'
import { mergeRegister } from '@lexical/utils'
import { MarkdownNode } from '@/lib/lexical/nodes/core/markdown'
import { $createCodeHighlightNode } from '@lexical/code'

export const SN_TOGGLE_MODE_COMMAND = createCommand('SN_TOGGLE_MODE_COMMAND')

export const MarkdownModeExtension = defineExtension({
  name: 'MarkdownModeExtension',
  dependencies: [CodeShikiSNExtension],
  register: (editor) => {
    return mergeRegister(
      // ensure there's always a code highlight node in the markdown node if it's empty
      editor.registerNodeTransform(MarkdownNode, node => {
        if (node.getChildren().length === 0) {
          node.append($createCodeHighlightNode())
          node.select()
        }
      }),
      editor.registerCommand(SN_TOGGLE_MODE_COMMAND, () => {
        $toggleMarkdownMode()
        return true
      }, COMMAND_PRIORITY_EDITOR)
    )
  }
})
