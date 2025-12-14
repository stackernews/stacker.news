import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { useField, useFormikContext } from 'formik'
import { $isMarkdownEmpty } from '@/lib/lexical/utils'
import { $getRoot, COMMAND_PRIORITY_HIGH, createCommand } from 'lexical'

export const SUBMIT_FORMIK_COMMAND = createCommand('SUBMIT_FORMIK_COMMAND')

/** syncs lexical with formik values */
export default function FormikBridgePlugin ({ name = 'text' }) {
  const [editor] = useLexicalComposerContext()
  const [,, textHelpers] = useField({ name })
  const formik = useFormikContext()

  // keep formik in sync
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        // if editor is empty, set empty string for formik validation
        if ($isMarkdownEmpty()) {
          textHelpers.setValue('')
          return
        }

        const text = $getRoot().getTextContent()

        textHelpers.setValue(text)
      })
    })
  }, [editor, textHelpers])

  useEffect(() => {
    return editor.registerCommand(
      SUBMIT_FORMIK_COMMAND,
      () => {
        formik?.submitForm()
        return true
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor, formik])

  return null
}
