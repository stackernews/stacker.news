import { useEffect, useRef, useCallback } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_CRITICAL } from 'lexical'
import { useField } from 'formik'
import styles from '@/lib/lexical/theme/editor.module.css'
import { useToolbarState } from '@/components/editor/contexts/toolbar'
import Text from '@/components/text'

export const TOGGLE_PREVIEW_COMMAND = createCommand('TOGGLE_PREVIEW_COMMAND')

export default function PreviewPlugin ({ editorRef, topLevel, name, minRows }) {
  const [editor] = useLexicalComposerContext()
  const { toolbarState, updateToolbarState } = useToolbarState()
  const [text] = useField({ name })
  const previewRef = useRef(null)

  // register toggle command
  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_PREVIEW_COMMAND,
      () => {
        // disable toggle if no text to preview
        if (!text.value) return false

        updateToolbarState('previewMode', !toolbarState.previewMode)
        return true
      },
      COMMAND_PRIORITY_CRITICAL
    )
  }, [editor, updateToolbarState, toolbarState.previewMode, text.value])

  // ??: duplicates shortcuts extension
  // but since the editor loses focus when toggling preview mode
  // we also need to handle the keydown event here
  const handlePreviewKeyDown = useCallback((e) => {
    const metaOrCtrl = e.metaKey || e.ctrlKey
    if (!metaOrCtrl) return
    if (e.key.toLowerCase() !== 'p') return

    e.preventDefault()
    editor.dispatchCommand(TOGGLE_PREVIEW_COMMAND, editor)
  }, [editor])

  // toggle editor and preview visibility
  useEffect(() => {
    if (!editorRef) return
    const previewEl = previewRef.current
    if (!previewEl) return

    const isPreview = toolbarState.previewMode
    editorRef.style.display = isPreview ? 'none' : ''
    previewEl.style.display = isPreview ? '' : 'none'

    if (isPreview) previewEl.focus({ preventScroll: true })
    else editor.focus()
  }, [toolbarState.previewMode, editorRef, editor])

  return (
    <div
      data-lexical-preview='true'
      tabIndex={-1} // focusable
      ref={previewRef}
      className={styles.editor}
      onKeyDown={handlePreviewKeyDown}
    >
      <Text className={styles.editorContent} topLevel={topLevel} preview name={name} minRows={minRows} />
    </div>
  )
}
