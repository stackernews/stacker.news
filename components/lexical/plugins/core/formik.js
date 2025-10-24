import { useFormikContext, useField } from 'formik'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useContext, useCallback, useEffect, useRef } from 'react'
import { StorageKeyPrefixContext } from '@/components/form'
import { $isMarkdownMode, $isRootEmpty, $initializeMarkdown } from '@/components/lexical/universal/utils'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import DefaultNodes from '@/lib/lexical/nodes'
import { $getRoot } from 'lexical'
import { RichTextExtension } from '@lexical/rich-text'
import { ListExtension, CheckListExtension } from '@lexical/list'
import { MediaCheckExtension } from '@/components/lexical/plugins/misc/media-check'
import { buildEditorFromExtensions, defineExtension } from '@lexical/extension'

function $parseMarkdown (editor) {
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  const markdown = firstChild?.getTextContent() || ''
  let lexicalState = ''
  const tempEditor = buildEditorFromExtensions(
    defineExtension({
      name: 'formikBridge',
      dependencies: [RichTextExtension, ListExtension, CheckListExtension, MediaCheckExtension],
      nodes: DefaultNodes,
      theme: editor._config.theme
    }))

  console.log('tempEditor', tempEditor)

  tempEditor.update(() => {
    $convertFromMarkdownString(markdown, SN_TRANSFORMERS, undefined, true)
  })

  tempEditor.read(() => {
    lexicalState = tempEditor.getEditorState().toJSON()
  })

  return { markdown, lexicalState }
}

export default function FormikPlugin ({ name }) {
  const [editor] = useLexicalComposerContext()
  const formik = useFormikContext()
  // text and lexicalState fields
  const [textField,, textHelpers] = useField({ name: 'text' })
  const [lexicalField,, lexicalHelpers] = useField({ name: 'lexicalState' })
  const hadContent = useRef(false)
  const lastSubmitCount = useRef(0)

  // local storage keys
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined

  const onChangeInner = useCallback((lexicalState) => {
    if (!storageKey) return
    const isEmpty = $isRootEmpty()
    if (isEmpty) {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(lexicalState))
    }
  }, [storageKey])

  const formikBridge = useCallback((editorState) => {
    editorState.read(() => {
      const isMarkdownMode = $isMarkdownMode()

      let markdown = ''
      const lexicalState = editorState.toJSON()

      // update the storage from the editor state
      onChangeInner(lexicalState)
      if (isMarkdownMode) {
        const root = $getRoot()
        const firstChild = root.getFirstChild()
        markdown = firstChild?.getTextContent() || ''
      } else {
        markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
        lexicalHelpers.setValue(JSON.stringify(editorState.toJSON()))
      }

      if (textField.value !== markdown) {
        textHelpers.setValue(markdown)
      }
    })
  }, [textField.value, onChangeInner, textHelpers, lexicalHelpers])

  useEffect(() => {
    if (formik.submitCount > lastSubmitCount.current) {
      lastSubmitCount.current = formik.submitCount
      editor.getEditorState().read(() => {
        const isMarkdownMode = $isMarkdownMode()

        if (isMarkdownMode) {
          const { markdown, lexicalState } = $parseMarkdown(editor)
          textHelpers.setValue(markdown)
          lexicalHelpers.setValue(JSON.stringify(lexicalState))
        }
      })
    }
  }, [formik.submitCount, editor, textHelpers, lexicalHelpers])

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
        lexicalHelpers.setValue(JSON.stringify(value))
      }
    }
  }, [storageKey, lexicalHelpers])

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      formikBridge(editorState)
    })
  }, [editor, formikBridge])

  // if the form is reset, clear the editor
  useEffect(() => {
    if (lexicalField.value && lexicalField.value !== '') {
      hadContent.current = true
    }

    if (hadContent.current && lexicalField.value === '') {
      editor.update(() => {
        const root = $getRoot()
        if ($isMarkdownMode()) {
          const firstChild = root.getFirstChild()
          if (typeof firstChild.bypassProtection === 'function') firstChild.bypassProtection()
          $initializeMarkdown()
        } else {
          root.clear()
        }
      })
    }
  }, [editor, lexicalField.value, hadContent])

  return null
}
