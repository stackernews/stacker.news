import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { $initializeEditorState } from '@/lib/lexical/utils'

export default function QuoteReplyPlugin ({ appendValue }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!appendValue) return
    editor.update(() => $initializeEditorState(appendValue))
  }, [appendValue, editor])

  return null
}
