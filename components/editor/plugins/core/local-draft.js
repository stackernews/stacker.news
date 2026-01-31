import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useContext, useCallback, useEffect } from 'react'
import { StorageKeyPrefixContext } from '@/components/form'
import { $isMarkdownEmpty, $setMarkdown, $getMarkdown } from '@/lib/lexical/utils'
import { lexicalToMarkdown } from '@/lib/lexical/utils/mdast'

/**
 * plugin that auto-saves and restores editor drafts to/from local storage

 * @param {string} props.name - storage key suffix for the draft
 */
export default function LocalDraftPlugin ({ name, editorMode }) {
  const [editor] = useLexicalComposerContext()

  // local storage keys, e.g. 'reply-123456-text'
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined

  /**
   * saves or removes draft from local storage based on editor emptiness
   * @param {string} text - markdown text content
   */
  const upsertDraft = useCallback((text) => {
    if (!storageKey) return

    // if the editor is empty, remove the draft
    if ($isMarkdownEmpty()) {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, text)
    }
  }, [storageKey])

  // load the draft from local storage
  useEffect(() => {
    if (storageKey) {
      const value = window.localStorage.getItem(storageKey)
      if (value) {
        editor.update(() => {
          if (editorMode === 'markdown') {
            $setMarkdown(value, false)
          } else {
            markdownToLexical(editor, value)
          }
        })
      }
    }
  }, [editor, storageKey, editorMode])

  // save the draft to local storage
  useEffect(() => {
    // whenever the editor state changes, save the markdown draft
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        if (editorMode === 'markdown') {
          upsertDraft($getMarkdown(false))
        } else {
          upsertDraft(lexicalToMarkdown(editor))
        }
      })
    })
  }, [editor, upsertDraft, editorMode])

  return null
}
