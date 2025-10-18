import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $createTextNode, $getRoot, createCommand, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { $createMarkdownNode } from '@/lib/lexical/nodes/core/markdown'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'

export const SN_TOGGLE_MODE_COMMAND = createCommand('SN_TOGGLE_MODE_COMMAND')

// this will switch between wysiwyg and markdown mode
// default is markdown
export function registerSNToggleModeCommand ({ editor }) {
  return editor.registerCommand(SN_TOGGLE_MODE_COMMAND, () => {
    $handleMarkdownSwitch()
    return true
  }, COMMAND_PRIORITY_EDITOR)
}

function $handleMarkdownSwitch () {
  const root = $getRoot()
  const markdownMode = $isMarkdownMode()
  if (markdownMode) {
    const firstChild = root.getFirstChild()
    // bypass markdown node removal protection
    if (typeof firstChild.bypassProtection === 'function') firstChild.bypassProtection()
    $convertFromMarkdownString(firstChild.getTextContent(), SN_TRANSFORMERS, undefined, true)
  } else {
    const markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
    const codeNode = $createMarkdownNode()
    codeNode.append($createTextNode(markdown))
    root.clear().append(codeNode)
    if (markdown.length === 0) codeNode.select()
  }
}
