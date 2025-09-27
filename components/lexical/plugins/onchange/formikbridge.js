import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useFormikContext } from 'formik'
import { useEffect, useContext, useCallback } from 'react'
import { $convertToMarkdownString, $convertFromMarkdownString } from '@lexical/markdown'
import { $isCodeNode } from '@lexical/code'
import { $getRoot, createEditor } from 'lexical'
import DefaultNodes from '@/lib/lexical/nodes'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { StorageKeyPrefixContext } from '@/components/form'

function parseMarkdown (editor, content) {
  const markdown = content.getTextContent()
  let lexicalState = ''
  const tempEditor = createEditor({
    nodes: [...DefaultNodes],
    theme: editor._config.theme
  })

  tempEditor.update(() => {
    $convertFromMarkdownString(markdown, SN_TRANSFORMERS, undefined, true)
  })

  tempEditor.read(() => {
    lexicalState = tempEditor.getEditorState().toJSON()
  })

  return { markdown, lexicalState }
}

// WIP: absolutely barebone formik bridge plugin for Lexical
export default function FormikBridgePlugin ({ name }) {
  const [editor] = useLexicalComposerContext()
  // TODO: useField to onChange
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined
  const { setFieldValue, values } = useFormikContext()

  const onChangeInner = useCallback((value) => {
    if (storageKey) {
      window.localStorage.setItem(storageKey, value)
    }
  }, [storageKey])

  useEffect(() => {
    if (storageKey) {
      const value = window.localStorage.getItem(storageKey)
      if (value) {
        editor.update(() => {
          const state = editor.parseEditorState(value)
          if (!state.isEmpty()) {
            editor.setEditorState(state)
          }
        })
        setFieldValue(name, value)
      }
    }
  }, [storageKey, setFieldValue, name])

  useEffect(() => {
    // probably we need to debounce this
    // holy shit this is a mess
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot()
        const firstChild = root.getFirstChild()

        let lexicalState = editorState.toJSON()
        let markdown = ''

        const isMarkdownMode = $isCodeNode(firstChild) && firstChild.getLanguage() === 'markdown'

        // Markdown Mode (codeblock)
        if (isMarkdownMode) {
          ({ markdown, lexicalState } = parseMarkdown(editor, firstChild))
        } else {
          markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
        }
        console.log('lexicalState', lexicalState)
        if (values.text === markdown) return
        onChangeInner(JSON.stringify(lexicalState))
        setFieldValue('text', markdown)
        setFieldValue('lexicalState', JSON.stringify(lexicalState))
      })
    })
  }, [editor, setFieldValue, values])

  return null
}
