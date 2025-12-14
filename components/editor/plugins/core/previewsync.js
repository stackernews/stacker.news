import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef } from 'react'
import { markdownToLexical } from '@/lib/lexical/utils/mdast'
import { useToolbarState } from '@/components/editor/contexts/toolbar'

/**
 * PreviewSyncPlugin synchronizes the preview editor state
 * with the given markdown (text) content, transforming it into a lexical state via MDAST.
 *
 * it only updates the preview editor state if the text has changed, and only if we're in preview mode.
 *
 * this plugin is disabled if not rendered under a toolbar context provider, i.e., under Editor.
 *
 * @param {string} props.text - the text to synchronize the preview with
 */
export default function PreviewSyncPlugin ({ text }) {
  const [editor] = useLexicalComposerContext()
  const toolbarContext = useToolbarState()
  const prevText = useRef(text)

  useEffect(() => {
    if (!toolbarContext) return
    if (!editor || !toolbarContext.toolbarState.previewMode) return
    if (prevText.current === text) return

    markdownToLexical(editor, text)
    prevText.current = text
  }, [editor, text, toolbarContext])

  return null
}
