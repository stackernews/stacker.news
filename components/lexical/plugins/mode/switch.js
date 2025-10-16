import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import styles from '@/components/lexical/theme/theme.module.css'
import { SN_TOGGLE_MODE_COMMAND } from '@/components/lexical/universal/commands/mode'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { useState, useEffect } from 'react'
import { getShortcutCombo } from '../shortcuts/keyboard'

export default function ModeSwitchPlugin () {
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
      className={styles.bottomBarItem}
      title={`${isMarkdownMode ? 'markdown mode' : 'rich mode'} (${getShortcutCombo('toggleMode')})`}
    >
      {isMarkdownMode ? 'markdown mode' : 'rich mode'}
    </span>
  )
}
