import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useFormikContext } from 'formik'
import { useEffect } from 'react'
import { TRANSFORMERS, $convertToMarkdownString } from '@lexical/markdown'
import { $isCodeNode } from '@lexical/code'
import { $getRoot } from 'lexical'

// WIP: absolutely barebone formik bridge plugin for Lexical
export default function FormikBridgePlugin () {
  const [editor] = useLexicalComposerContext()
  const { setFieldValue, values } = useFormikContext()

  useEffect(() => {
    // probably we need to debounce this
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        // if codeblock getTextContent
        const root = $getRoot()
        const firstChild = root.getFirstChild()
        let markdown = ''
        if ($isCodeNode(firstChild) && firstChild.getLanguage() === 'markdown') {
          markdown = firstChild.getTextContent()
        } else {
          markdown = $convertToMarkdownString(TRANSFORMERS, undefined, true)
        }
        if (values.text === markdown) return
        console.log('markdown', markdown)
        setFieldValue('text', markdown)
        console.log('values', values)
      })
    })
  }, [editor, setFieldValue, values])

  return null
}
