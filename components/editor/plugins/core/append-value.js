import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { $appendMarkdown } from '@/lib/lexical/utils'

/**
 * plugin that appends a value to the editor
 * @param {string} [props.value] - value to append
 * @param {React.RefObject} [props.appendedValueRef] - ref to the last appended value
 */
export default function AppendValuePlugin ({ value, appendedValueRef }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    // dedupe appends
    // we're passing it from the Editor to avoid duplications on mode switches
    if (value && value !== appendedValueRef.current) {
      appendedValueRef.current = value
      editor.update(() => {
        $appendMarkdown(value, true, 2)
      })
    } else if (!value) {
      // clear on cancel quote
      appendedValueRef.current = null
    }
  }, [editor, value])

  return null
}
