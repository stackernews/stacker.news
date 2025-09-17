import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useFormikContext } from 'formik'
import { useEffect } from 'react'
import { $convertToMarkdownString, $convertFromMarkdownString } from '@lexical/markdown'
import { $isCodeNode } from '@lexical/code'
import { $getRoot, createEditor } from 'lexical'
import { $generateHtmlFromNodes } from '@lexical/html'
import defaultNodes from '../../../../lib/lexical/nodes'
import { SN_TRANSFORMERS } from '@/lib/lexical/transformers/image-markdown-transformer'

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
        let html = ''
        if ($isCodeNode(firstChild) && firstChild.getLanguage() === 'markdown') {
          markdown = firstChild.getTextContent()

          console.log('nodes', editor._config)
          console.log('onError', editor._config.onError)
          console.log('theme', editor._config.theme)

          const tempEditor = createEditor({
            nodes: defaultNodes,
            theme: editor._config.theme
          })

          tempEditor.update(() => {
            $convertFromMarkdownString(markdown, SN_TRANSFORMERS)
          })

          html = tempEditor.read(() => {
            return $generateHtmlFromNodes(tempEditor, null)
          })
        } else {
          markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
          html = $generateHtmlFromNodes(editor, null)
        }
        if (values.text === markdown) return
        setFieldValue('text', markdown)
        setFieldValue('lexicalState', JSON.stringify(editorState.toJSON()))
        setFieldValue('html', html)
      })
    })
  }, [editor, setFieldValue, values])

  return null
}
