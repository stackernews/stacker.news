import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useContext, useCallback, useEffect } from 'react'
import { StorageKeyPrefixContext } from '@/components/form'
import { $isRootEmpty } from '@/components/lexical/universal/utils'

// loads and saves a draft of the editor state to local storage
export default function LocalDraftPlugin ({ name }) {
  const [editor] = useLexicalComposerContext()

  // local storage keys, e.g. 'reply-123456-text'
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined

  const upsertDraft = useCallback((lexicalState) => {
    if (!storageKey) return

    // if the editor is empty, remove the draft
    if ($isRootEmpty()) {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(lexicalState))
    }
  }, [storageKey])

  // load the draft from local storage
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
      }
    }
  }, [editor, storageKey])

  // save the draft to local storage
  useEffect(() => {
    // whenever the editor state changes, save the draft
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        upsertDraft(editorState.toJSON())
      })
    })
  }, [editor, upsertDraft])

  return null
}
