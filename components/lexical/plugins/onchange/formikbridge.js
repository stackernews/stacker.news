import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useFormikContext } from 'formik'
import { useEffect } from 'react'
import { $convertToMarkdownString, $convertFromMarkdownString } from '@lexical/markdown'
import { $isCodeNode } from '@lexical/code'
import { $getRoot, createEditor } from 'lexical'
import { $generateHtmlFromNodes } from '@lexical/html'
import defaultNodes from '../../../../lib/lexical/nodes'
import { SN_TRANSFORMERS } from '@/lib/lexical/transformers/image-markdown-transformer'

function parseMarkdown (editor, content) {
  const markdown = content.getTextContent()
  const tempEditor = createEditor({
    nodes: defaultNodes,
    theme: editor._config.theme
  })

  tempEditor.update(() => {
    $convertFromMarkdownString(markdown, SN_TRANSFORMERS)
  })

  const html = tempEditor.read(() => {
    return $generateHtmlFromNodes(tempEditor, null)
  })

  return { markdown, html }
}

// WIP: absolutely barebone formik bridge plugin for Lexical
export default function FormikBridgePlugin () {
  const [editor] = useLexicalComposerContext()
  const { setFieldValue, values } = useFormikContext()

  useEffect(() => {
    // probably we need to debounce this
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot()
        const firstChild = root.getFirstChild()
        let markdown = ''
        let html = ''
        // markdown mode (codeblock), may not see the light
        if ($isCodeNode(firstChild) && firstChild.getLanguage() === 'markdown') {
          ({ markdown, html } = parseMarkdown(editor, firstChild))
        } else {
          const rootElement = editor.getRootElement()
          // live markdown mode
          if (rootElement?.classList.contains('md-live')) {
            ({ markdown, html } = parseMarkdown(editor, root))
          // wysiwyg mode
          } else {
            markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
            html = $generateHtmlFromNodes(editor, null)
          }
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
