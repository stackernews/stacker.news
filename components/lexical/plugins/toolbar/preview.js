import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { $generateHtmlFromNodes } from '@lexical/html'
import { $isCodeNode } from '@lexical/code'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { SN_TRANSFORMERS } from '@/lib/lexical/transformers/image-markdown-transformer'
import { $getRoot, createEditor } from 'lexical'
import defaultNodes from '../../../../lib/lexical/nodes'

// WIP: unused
export default function PreviewPlugin ({ setPreviewHtml }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    editor.registerUpdateListener(({ editorState }) => {
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
        setPreviewHtml(html)
        console.log('html', html)
      })
    })
  }, [editor, setPreviewHtml])

  return null
}
