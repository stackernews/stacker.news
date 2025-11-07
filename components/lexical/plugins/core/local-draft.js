import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useContext, useCallback, useEffect } from 'react'
import { StorageKeyPrefixContext } from '@/components/form'
import { $isRootEmpty } from '@/lib/lexical/universal/utils'

/**
 * plugin that auto-saves and restores editor drafts to/from local storage

 * @param {string} props.name - storage key suffix for the draft
 */
export default function LocalDraftPlugin ({ name }) {
  const [editor] = useLexicalComposerContext()

  // local storage keys, e.g. 'reply-123456-text'
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined

  /**
   * saves or removes draft from local storage based on editor emptiness
   * @param {Object} lexicalState - serialized lexical editor state
   */
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
          try {
            const state = editor.parseEditorState(value)
            if (!state.isEmpty()) {
              editor.setEditorState(state)
            }
          } catch (error) {
            console.error('error parsing editor state:', error)
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
