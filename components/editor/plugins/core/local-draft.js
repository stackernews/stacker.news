import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useContext, useCallback, useEffect } from 'react'
import { StorageKeyPrefixContext } from '@/components/form'
import { $isMarkdownEmpty, $setMarkdown, $getMarkdown } from '@/lib/lexical/utils'
import { $markdownToLexical, $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
import { isMarkdownMode } from '@/lib/lexical/commands/utils'

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
          const isMarkdown = isMarkdownMode(editor)
          if (isMarkdown) {
            $setMarkdown(value)
          } else {
            $markdownToLexical(value)
          }
        })
      }
    }
  }, [editor, storageKey])

  // save the draft to local storage
  useEffect(() => {
    // whenever the editor state changes, save the markdown draft
    return editor.registerUpdateListener(({ dirtyElements, dirtyLeaves, editorState }) => {
      const isMarkdown = isMarkdownMode(editor)
      // skip non-content updates
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return

      editorState.read(() => {
        const text = isMarkdown
          ? $getMarkdown(false)
          : $lexicalToMarkdown()
        upsertDraft(text)
      })
    })
  }, [editor, upsertDraft])

  return null
}
