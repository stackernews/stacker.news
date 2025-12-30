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
    if (!value) return
    if (lastAppendedRef.current === value) editor.focus()

    editor.update(() => {
      $appendMarkdown(value)
      lastAppendedRef.current = value
    })
  }, [value, editor])

  return null
}
