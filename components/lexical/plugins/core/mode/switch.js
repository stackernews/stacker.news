import { useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useClientShortcut } from '@/lib/lexical/extensions/core/shortcuts/keyboard'
import { SN_TOGGLE_MODE_COMMAND } from '@/lib/lexical/extensions/core/mode'
import styles from '@/components/lexical/theme/theme.module.css'
import { $isMarkdownMode } from '@/lib/lexical/universal/utils'
import classNames from 'classnames'

/** displays and toggles between markdown and rich text modes */
export default function ModeSwitcherPlugin ({ className }) {
  const [editor] = useLexicalComposerContext()
  const [isMD, setIsMD] = useState(false)
  const shortcut = useClientShortcut('toggleMode')

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setIsMD($isMarkdownMode())
      })
    })
  }, [editor])

  const modeText = isMD ? 'markdown mode' : 'rich mode'
  const title = shortcut ? `${modeText} ${shortcut}` : modeText

  return (
    <span
      onClick={() => editor.dispatchCommand(SN_TOGGLE_MODE_COMMAND)}
      className={classNames(styles.bottomBarItem, className)}
      title={title}
    >
      {modeText}
    </span>
  )
}
