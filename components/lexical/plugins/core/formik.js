import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef } from 'react'
import { useField } from 'formik'
import { $initializeEditorState, $isMarkdownMode, $isRootEmpty } from '@/lib/lexical/universal/utils'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $getRoot } from 'lexical'
import useHeadlessBridge from './use-headless-bridge'
import { MediaCheckExtension } from '@/lib/lexical/extensions/content/media-check'

/**
 * converts markdown to lexical state using a temporary bridge editor
 * @param {React.RefObject} bridge - headless editor instance
 * @param {string} markdown - markdown string to convert
 * @returns {string} serialized lexical state as JSON
 */
function $prepareMarkdown (bridge, markdown) {
  let lexicalState = ''

  try {
    // convert the markdown to a lexical state
    bridge.current.update(() => {
      $convertFromMarkdownString(markdown, SN_TRANSFORMERS, undefined, false)
    })

    bridge.current.read(() => {
      lexicalState = bridge.current.getEditorState().toJSON()
    })
  } catch (error) {
    console.error('cannot prepare markdown using bridge:', error)
  }

  return lexicalState
}

// TODO: check if we're doing too much by preparing markdown on each keystroke
// we may also already have prepareMarkdown in the server-side interpolator
/** syncs lexical editor state with formik form field values */
export default function FormikBridgePlugin () {
  const [editor] = useLexicalComposerContext()
  const bridge = useHeadlessBridge({ extensions: [MediaCheckExtension] })
  const [lexicalField,, lexicalHelpers] = useField({ name: 'lexicalState' })
  const hadContent = useRef(false)

  // keep formik in sync, so it doesn't yell at us
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const isMarkdownMode = $isMarkdownMode()

        // if editor is empty, set empty string for formik validation
        if ($isRootEmpty()) {
          lexicalHelpers.setValue('')
          return
        }

        let markdown = ''
        let lexicalState = editorState.toJSON()

        if (isMarkdownMode) {
          markdown = $getRoot().getFirstChild()?.getTextContent() || ''
          lexicalState = $prepareMarkdown(bridge, markdown)
        } else {
          markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, false)
        }

        lexicalHelpers.setValue(JSON.stringify(lexicalState))
      })
    })
  }, [editor, lexicalHelpers, bridge])

  // reset the editor state if the field is/goes empty
  useEffect(() => {
    if (lexicalField.value !== '') {
      hadContent.current = true
    }

    if (lexicalField.value === '' && hadContent.current) {
      hadContent.current = false
      editor.update(() => $initializeEditorState($isMarkdownMode()))
    }
  }, [editor, lexicalField.value])

  return null
}
