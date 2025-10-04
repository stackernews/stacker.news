import { $getRoot } from 'lexical'
import { $isMarkdownNode } from '@/lib/lexical/nodes/markdownnode'

// only in editor reads and updates
export function $isMarkdownMode () {
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild)
}

// useful in commands
export function getMarkdownMode (editor) {
  if (!editor) return false
  return editor.getEditorState().read(() => $isMarkdownMode())
}
