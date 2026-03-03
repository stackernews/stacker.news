import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useContext, useCallback, useEffect } from 'react'
import { StorageKeyPrefixContext } from '@/components/form'
import { $isTextEmpty, $setText, $getTextContent } from '@/lib/lexical/utils'
import { $markdownToLexical, $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
import { isMarkdownMode } from '@/lib/lexical/commands/utils'
import useDebounceCallback from '@/components/use-debounce-callback'
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
  const upsertDraft = useCallback((text) => {
    if (!storageKey) return

    // if the editor is empty, remove the draft
    if ($isTextEmpty()) {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, text)
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
  }, [editor, storageKey])

  // debounces draft saving in rich mode to prevent frequent conversions to MDAST
  // XXX: ideally we would save the draft as a Lexical EditorState, as it would
  // tell us the a) last editor mode, b) let the user resume exactly where they left off
  const debouncedRichSave = useDebounceCallback(() => {
    if (isMarkdownMode(editor)) return
    editor.getEditorState().read(() => {
      upsertDraft($lexicalToMarkdown())
    })
  }, 500, [editor, upsertDraft])

  // save the draft to local storage
  useEffect(() => {
    return editor.registerUpdateListener(({ dirtyElements, dirtyLeaves, editorState }) => {
      // skip non-content updates
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return

      if (isMarkdownMode(editor)) {
        editorState.read(() => {
          upsertDraft($getTextContent(false))
        })
      } else {
        debouncedRichSave()
      }
    })
  }, [editor, upsertDraft, debouncedRichSave])

  return null
}
