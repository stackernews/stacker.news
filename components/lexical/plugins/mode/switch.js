import { useCallback, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $createTextNode, $getRoot, createCommand, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { $createMarkdownNode } from '@/lib/lexical/nodes/markdownnode'
import { mergeRegister } from '@lexical/utils'

export const SN_TOGGLE_MODE_COMMAND = createCommand('SN_TOGGLE_MODE_COMMAND')

// this will switch between wysiwyg and markdown mode
// default is markdown
export default function SwitchPlugin ({ markdownMode }) {
  const [editor] = useLexicalComposerContext()

  const handleMarkdownSwitch = useCallback(() => {
    editor.update(() => {
      const root = $getRoot()
      const firstChild = root.getFirstChild()
      if (markdownMode) {
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
    }, { tag: 'sn-mode-switch' })
  }, [editor, markdownMode])

  useEffect(() => {
    const unregister = mergeRegister(
      editor.registerCommand(SN_TOGGLE_MODE_COMMAND, () => {
        handleMarkdownSwitch()
        return true
      }, COMMAND_PRIORITY_EDITOR)
    )
    return () => {
      unregister()
    }
  }, [editor, handleMarkdownSwitch])

  return null
}
