import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef } from 'react'
import { $appendMarkdown } from '@/lib/lexical/utils'

/**
 * plugin that reacts to 'value' changes and appends it to the editor state
 * @param {string} props.value - value to append to the editor state
 */
export default function AppendValuePlugin ({ value }) {
  const [editor] = useLexicalComposerContext()
  const lastAppendedRef = useRef(null)

  useEffect(() => {
    if (!value) {
      // allow same appends to happen when onCancel(Quote) is called
      lastAppendedRef.current = null
      return
    }
    if (lastAppendedRef.current === value) return

    lastAppendedRef.current = value
    editor.update(() => {
      $appendMarkdown(value)
    })
  }, [value, editor])

  return null
}
