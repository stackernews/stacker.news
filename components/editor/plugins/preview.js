import { useEffect, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_CRITICAL } from 'lexical'
import { useFormikContext } from 'formik'
import styles from '@/lib/lexical/theme/editor.module.css'
import { useToolbarState } from '@/components/editor/contexts/toolbar'
import Text from '@/components/text'

export const TOGGLE_PREVIEW_COMMAND = createCommand('TOGGLE_PREVIEW_COMMAND')

export default function PreviewPlugin ({ editorRef, topLevel }) {
  const [editor] = useLexicalComposerContext()
  const { toolbarState, updateToolbarState } = useToolbarState()
  const { values } = useFormikContext()
  const previewRef = useRef(null)

  // register toggle command
  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_PREVIEW_COMMAND,
      () => {
        updateToolbarState('previewMode', !toolbarState.previewMode)
        return true
      },
      COMMAND_PRIORITY_CRITICAL
    )
  }, [editor, updateToolbarState, toolbarState.previewMode])

  // toggle editor and preview visibility
  useEffect(() => {
    if (!editorRef) return
    editorRef.style.display = toolbarState.previewMode ? 'none' : ''
    previewRef.current.style.display = toolbarState.previewMode ? '' : 'none'
  }, [toolbarState, editorRef, previewRef])

  return (
    <div data-lexical-preview='true' ref={previewRef} className={styles.editor}>
      <Text className={styles.editorInput} topLevel={topLevel}>{values.text}</Text>
    </div>
  )
}
