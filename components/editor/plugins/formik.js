import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef } from 'react'
import { useField } from 'formik'
import { $initializeEditorState, $isMarkdownEmpty } from '@/lib/lexical/utils'
import { $getRoot } from 'lexical'

// TODO: check if we're doing too much by preparing markdown on each keystroke
// we may also already have prepareMarkdown in the server-side interpolator
/** syncs lexical editor state with formik form field values */
export default function FormikBridgePlugin () {
  const [editor] = useLexicalComposerContext()
  const [textField,, textHelpers] = useField({ name: 'text' })
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
