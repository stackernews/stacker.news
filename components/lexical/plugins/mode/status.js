import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import styles from '@/components/lexical/theme/theme.module.css'
import { SN_TOGGLE_MODE_COMMAND } from './switch'
import { $isMarkdownMode } from '@/components/lexical/universal/utils/mode'
import { useState, useEffect } from 'react'

export default function ModeStatusPlugin () {
  const [editor] = useLexicalComposerContext()
  const [isMarkdownMode, setIsMarkdownMode] = useState(false)

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setIsMarkdownMode($isMarkdownMode())
      })
    })
  }, [editor])

  return (
    <span
      onClick={() => editor.dispatchCommand(SN_TOGGLE_MODE_COMMAND)}
      className={styles.modeStatus}
    >
      {isMarkdownMode ? 'markdown mode' : 'hybrid mode'}
    </span>
  )
}
