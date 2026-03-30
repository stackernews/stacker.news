import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useContext, useCallback, useEffect } from 'react'
import { StorageKeyPrefixContext } from '@/components/form'
import { $setText } from '@/lib/lexical/utils'
import { $markdownToLexical } from '@/lib/lexical/utils/mdast'
import { isMarkdownMode } from '@/lib/lexical/commands/utils'
import { useField } from 'formik'

/**
 * plugin that auto-saves and restores editor drafts to/from local storage

 * @param {string} props.name - storage key suffix for the draft
 */
export default function LocalDraftPlugin ({ name }) {
  const [editor] = useLexicalComposerContext()
  const [text] = useField({ name })

  // local storage keys, e.g. 'reply-123456-text'
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined

  /**
   * saves or removes draft from local storage based on editor emptiness
   * @param {string} text - markdown text content
   */
  const upsertDraft = useCallback((value) => {
    if (!storageKey) return

    // remove the draft if text is empty
    if (!value || value.trim() === '') {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, value)
    }
  }, [storageKey])

  // load the draft from local storage
  useEffect(() => {
    // prefer Formik value over local storage
    if (text?.value) return
    if (storageKey) {
      const value = window.localStorage.getItem(storageKey)
      if (value) {
        editor.update(() => {
          const isMarkdown = isMarkdownMode(editor)
          if (isMarkdown) {
            $setText(value)
          } else {
            $markdownToLexical(value)
          }
        })
      }
    }
  // we're not depending on text.value here because we need to load the draft on mount, not on change
  }, [editor, storageKey])

  // save the draft to local storage
  useEffect(() => {
    upsertDraft(text.value)
  }, [upsertDraft, text.value])

  return null
}
