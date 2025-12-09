import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef } from 'react'
import { useField, useFormikContext } from 'formik'
import { $initializeEditorState, $isMarkdownEmpty } from '@/lib/lexical/utils'
import { $getRoot, COMMAND_PRIORITY_HIGH, createCommand } from 'lexical'

export const SUBMIT_FORMIK_COMMAND = createCommand('SUBMIT_FORMIK_COMMAND')

/** syncs lexical with formik values */
export default function FormikBridgePlugin ({ name = 'text' }) {
  const [editor] = useLexicalComposerContext()
  const [textField,, textHelpers] = useField({ name })
  const formik = useFormikContext()
  const hadContent = useRef(false)

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

  // reset the editor state if the field is/goes empty
  useEffect(() => {
    if (textField.value !== '') {
      hadContent.current = true
    }

    if (textField.value === '' && hadContent.current) {
      hadContent.current = false
      editor.update(() => $initializeEditorState(editor))
    }
  }, [editor, textField.value])

  return null
}
