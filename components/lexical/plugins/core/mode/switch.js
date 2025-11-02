import { useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { getShortcutCombo } from '../../../extensions/core/shortcuts/keyboard'
import { SN_TOGGLE_MODE_COMMAND } from '@/components/lexical/extensions/core/mode'
import styles from '@/components/lexical/theme/theme.module.css'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import classNames from 'classnames'

export default function ModeSwitcher ({ className }) {
  const [editor] = useLexicalComposerContext()
  const [isMD, setIsMD] = useState(false)

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setIsMD($isMarkdownMode())
      })
    })
  }, [editor])

  return (
    <span
      onClick={() => editor.dispatchCommand(SN_TOGGLE_MODE_COMMAND)}
      className={classNames(styles.bottomBarItem, className)}
      title={`${isMD ? 'markdown mode' : 'rich mode'} (${getShortcutCombo('toggleMode')})`}
      suppressHydrationWarning
    >
      {isMD ? 'markdown mode' : 'rich mode'}
    </span>
  )
}
