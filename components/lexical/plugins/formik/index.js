import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useFormikContext } from 'formik'
import { useEffect, useContext, useCallback, useRef } from 'react'
import { $convertToMarkdownString, $convertFromMarkdownString } from '@lexical/markdown'
import { $getRoot, createEditor } from 'lexical'
import DefaultNodes from '@/lib/lexical/nodes'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { StorageKeyPrefixContext } from '@/components/form'
import { $isMarkdownNode } from '@/lib/lexical/nodes/markdownnode'

function $parseMarkdown (editor, content) {
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
  const hadContent = useRef(false)

  // update the storage from the editor state
  const onChangeInner = useCallback((value) => {
    if (storageKey) {
      window.localStorage.setItem(storageKey, value)
    }
  }, [storageKey])

  // update the formik state from the editor state
  const lexicalFormikify = useCallback((editorState) => {
    editorState.read(() => {
      const root = $getRoot()
      const firstChild = root.getFirstChild()

      let lexicalState = editorState.toJSON()
      // update the storage from the editor state
      onChangeInner(JSON.stringify(lexicalState))
      let markdown = ''

      if ($isMarkdownNode(firstChild)) {
        ({ markdown, lexicalState } = $parseMarkdown(editor, firstChild))
      } else {
        markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
      }

      // useless to update storage if the values are the same
      if (values.text === markdown && values.lexicalState === JSON.stringify(lexicalState)) return
      setFieldValue('text', markdown)
      setFieldValue('lexicalState', JSON.stringify(lexicalState))
    })
  }, [editor, setFieldValue, values, onChangeInner])

  // set the editor state from storage
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

  // update the formik state from the editor state
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      lexicalFormikify(editorState)
    })
  }, [editor, lexicalFormikify])

  // if the form is reset, clear the editor
  useEffect(() => {
    if (values.lexicalState && values.lexicalState !== '') {
      hadContent.current = true
    }

    if (hadContent.current && values.lexicalState === '') {
      // This is a reset, not initial empty state
      editor.update(() => {
        const root = $getRoot()
        root.clear()
      })
    }
  }, [editor, values.lexicalState])

  return null
}
