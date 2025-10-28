import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { useField } from 'formik'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { buildEditorFromExtensions, defineExtension } from '@lexical/extension'
import { RichTextExtension } from '@lexical/rich-text'
import { ListExtension, CheckListExtension } from '@lexical/list'
import { MediaCheckExtension } from '@/components/lexical/plugins/misc/media-check'
import DefaultNodes from '@/lib/lexical/nodes'
import { $getRoot } from 'lexical'

function $prepareMarkdown (editor, markdown) {
  let lexicalState = ''

  const tempEditor = buildEditorFromExtensions(
    defineExtension({
      onError: (error) => console.error('stacker news form bridge has encountered an error:', error),
      name: 'formikBridge',
      dependencies: [RichTextExtension, ListExtension, CheckListExtension, MediaCheckExtension],
      nodes: DefaultNodes,
      theme: editor._config.theme
    }))

  // convert the markdown to a lexical state
  tempEditor.update(() => {
    $convertFromMarkdownString(markdown, SN_TRANSFORMERS, undefined, true)
  })

  tempEditor.read(() => {
    lexicalState = tempEditor.getEditorState().toJSON()
  })

  return lexicalState
}

export default function FormikBridgePlugin () {
  const [editor] = useLexicalComposerContext()
  const [,, lexicalHelpers] = useField({ name: 'lexicalState' })

  // keep formik in sync, so it doesn't yell at us
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const isMarkdownMode = $isMarkdownMode()

        let markdown = ''
        let lexicalState = editorState.toJSON()

        if (isMarkdownMode) {
          markdown = $getRoot().getFirstChild()?.getTextContent() || ''
          lexicalState = $prepareMarkdown(editor, markdown)
        } else {
          markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
        }

        lexicalHelpers.setValue(JSON.stringify(lexicalState))
      })
    })
  }, [editor, lexicalHelpers])

  return null
}
