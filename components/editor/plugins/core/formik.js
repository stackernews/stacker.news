import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { useField, useFormikContext } from 'formik'
import { $isMarkdownEmpty, $getMarkdown } from '@/lib/lexical/utils'
import { COMMAND_PRIORITY_HIGH, createCommand } from 'lexical'
import { useToolbarState } from '@/components/editor/contexts/toolbar'
import { $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
import { useFeeButton } from '@/components/fee-button'

export const SUBMIT_FORMIK_COMMAND = createCommand('SUBMIT_FORMIK_COMMAND')

/** syncs lexical with formik values */
export default function FormikBridgePlugin ({ name = 'text' }) {
  const [editor] = useLexicalComposerContext()
  const [,, textHelpers] = useField({ name })
  const formik = useFormikContext()
  const { toolbarState } = useToolbarState()
  const { disabled = false } = useFeeButton() ?? {}

  // keep formik in sync
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        // if editor is empty, set empty string for formik validation
        if ($isMarkdownEmpty()) {
          textHelpers.setValue('')
          return
        }

        const text = toolbarState.markdownMode ? $getMarkdown() : $lexicalToMarkdown()

        textHelpers.setValue(text)
      })
    })
  }, [editor, textHelpers, toolbarState.markdownMode])

  useEffect(() => {
    return editor.registerCommand(
      SUBMIT_FORMIK_COMMAND,
      () => {
        if (disabled) return false
        formik?.submitForm()
        return true
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor, formik, disabled])

  return null
}
