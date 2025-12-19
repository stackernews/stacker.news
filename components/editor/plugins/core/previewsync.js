import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef } from 'react'
import { markdownToLexical } from '@/lib/lexical/utils/mdast'
import { useToolbarState } from '@/components/editor/contexts/toolbar'
import { useField } from 'formik'

/**
 * PreviewSyncPlugin synchronizes the preview editor state
 * with the given markdown (text) content, transforming it into a lexical state via MDAST.
 *
 * it only updates the preview editor state if the text has changed, and only if we're in preview mode.
 *
 * this plugin is disabled if not rendered under a toolbar context provider, i.e., under Editor.
 *
 */
export default function PreviewSyncPlugin () {
  const [editor] = useLexicalComposerContext()
  const [text] = useField({ name: 'text' })
  const toolbarContext = useToolbarState()
  const prevText = useRef('')

  useEffect(() => {
    if (!toolbarContext) return
    if (!editor || !toolbarContext.toolbarState.previewMode) return
    if (prevText.current === text.value) return

    prevText.current = text.value
    // if the text is empty, return to editor
    if (text.value.trim() === '') {
      toolbarContext.updateToolbarState('previewMode', false)
      return
    }

    markdownToLexical(editor, text.value)
  }, [editor, text.value, toolbarContext?.toolbarState.previewMode])

  return null
}
