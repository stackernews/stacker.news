import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef } from 'react'
import { useFieldDraft } from '@/components/form/use-field-draft'
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
  const prevText = useRef(text.value)

  const { getDraft, setDraft } = useFieldDraft(name)

  // load the draft
  useEffect(() => {
    // prefer Formik value over local storage
    if (text?.value) return
    const value = getDraft()
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
  // omit text.value so typing doesn't reload the draft
  }, [editor, getDraft])

  // save the draft
  useEffect(() => {
    // don't overwrite the stored draft on mount or editor mode changes
    if (prevText.current === text.value) return
    prevText.current = text.value

    setDraft(text.value)
  }, [setDraft, text.value])

  return null
}
