import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_CRITICAL } from 'lexical'
import { useFormikContext } from 'formik'
import Reader from '../../reader'
import styles from '@/components/editor/theme/editor.module.css'
import { useToolbarState } from '../../contexts/toolbar'
import classNames from 'classnames'

export const TOGGLE_PREVIEW_COMMAND = createCommand('TOGGLE_PREVIEW_COMMAND')

export default function PreviewPlugin ({ editorRef, topLevel }) {
  const [editor] = useLexicalComposerContext()
  const { toolbarState, updateToolbarState } = useToolbarState()
  const { values } = useFormikContext()

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
  }, [editor, updateToolbarState])

  // toggle editor visibility
  useEffect(() => {
    if (!editorRef) return
    editorRef.style.display = toolbarState.previewMode ? 'none' : ''
  }, [toolbarState, editorRef])

  if (!toolbarState.previewMode) return null

  return (
    <div className={styles.previewWrapper}>
      <Reader
        markdown={values.text}
        className={classNames(styles.editorInput, 'sn__text', topLevel && 'sn__topLevel')}
        topLevel={topLevel}
      />
    </div>
  )
}
