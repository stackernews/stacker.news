import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useFormikContext } from 'formik'
import { useEffect } from 'react'
import { TRANSFORMERS, $convertToMarkdownString } from '@lexical/markdown'

// WIP: absolutely barebone formik bridge plugin for Lexical
export default function FormikBridgePlugin () {
  const [editor] = useLexicalComposerContext()
  const { setFieldValue, values } = useFormikContext()

  useEffect(() => {
    // probably we need to debounce this
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const markdown = $convertToMarkdownString(TRANSFORMERS, undefined, true)
        if (values.text === markdown) return
        console.log('markdown', markdown)
        setFieldValue('text', markdown)
        console.log('values', values)
      })
    })
  }, [editor, setFieldValue, values])

  return null
}
