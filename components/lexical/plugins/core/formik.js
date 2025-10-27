import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useImperativeHandle, useEffect } from 'react'
import { useField } from 'formik'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { buildEditorFromExtensions, defineExtension } from '@lexical/extension'
import { RichTextExtension } from '@lexical/rich-text'
import { ListExtension, CheckListExtension } from '@lexical/list'
import { MediaCheckExtension } from '@/components/lexical/plugins/misc/media-check'
import DefaultNodes from '@/lib/lexical/nodes'
import { $getRoot, $nodesOfType } from 'lexical'
import { MediaNode } from '@/lib/lexical/nodes/content/media/media'

async function $prepareMarkdown (editor, markdown) {
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

  // check the media nodes
  const pendingChecks = []
  tempEditor.read(() => {
    const mediaNodes = $nodesOfType(MediaNode)
    mediaNodes.forEach(node => {
      if ((node.getStatus() === 'pending' || node.getStatus() === 'idle') && node.getSrc()) {
        const promise = tempEditor.checkMediaNode?.(node.getKey(), node.getSrc())
        if (promise) {
          pendingChecks.push(promise)
        }
      }
    })
  })

  if (pendingChecks.length > 0) {
    await Promise.allSettled(pendingChecks)
  }

  tempEditor.read(() => {
    lexicalState = tempEditor.getEditorState().toJSON()
  })

  return lexicalState
}

export default function FormikBridgePlugin ({ bridgeRef }) {
  const [editor] = useLexicalComposerContext()
  const [,, textHelpers] = useField({ name: 'text' })
  const [,, lexicalHelpers] = useField({ name: 'lexicalState' })

  // keep formik in sync, so it doesn't yell at us
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const isMarkdownMode = $isMarkdownMode()

        if (isMarkdownMode) {
          const markdown = $getRoot().getFirstChild()?.getTextContent() || ''
          textHelpers.setValue(markdown)
        } else {
          const markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
          textHelpers.setValue(markdown)
        }

        lexicalHelpers.setValue(JSON.stringify(editorState.toJSON()))
      })
    })
  }, [editor, textHelpers, lexicalHelpers])

  // prepares the lexical state for submission
  useImperativeHandle(bridgeRef, () => ({
    prepare: async () => {
      try {
        return await editor.getEditorState().read(async () => {
          const isMarkdownMode = $isMarkdownMode()

          let markdown = ''
          let lexicalState = editor.getEditorState().toJSON()

          if (isMarkdownMode) {
            markdown = $getRoot().getFirstChild()?.getTextContent() || ''
            lexicalState = await $prepareMarkdown(editor, markdown)
          } else {
            markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
          }

          // probably useless
          lexicalHelpers.setValue(lexicalState)
          textHelpers.setValue(markdown)

          return {
            valid: true,
            values: {
              text: markdown,
              lexicalState: JSON.stringify(lexicalState)
            }
          }
        })
      } catch (error) {
        console.error('stacker news form bridge has encountered an error:', error)
        return {
          valid: false,
          message: error.message || 'Failed to validate content'
        }
      }
    }
  }), [editor, textHelpers, lexicalHelpers])

  return null
}
