import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef } from 'react'
import { $appendMarkdown } from '@/lib/lexical/utils'

/**
 * plugin that appends a value to the editor
 * @param {string} value - value to append
 */
export default function AppendValuePlugin ({ value }) {
  const [editor] = useLexicalComposerContext()
  const prevValueRef = useRef()

  useEffect(() => {
    // dedupe appends
    if (value && value !== prevValueRef.current) {
      prevValueRef.current = value
      editor.update(() => {
        $appendMarkdown(value, 2)
      })
    } else if (!value) {
      // clear on cancel quote
      prevValueRef.current = null
    }
  }, [editor, value])

  return null
}
