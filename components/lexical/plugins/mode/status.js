import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import styles from '@/components/lexical/theme/theme.module.css'
import { SN_TOGGLE_MODE_COMMAND } from './switch'

export default function ModeStatusPlugin ({ markdownMode }) {
  const [editor] = useLexicalComposerContext()

  return (
    <span
      onClick={() => editor.dispatchCommand(SN_TOGGLE_MODE_COMMAND)}
      className={styles.modeStatus}
    >
      {markdownMode ? 'markdown mode' : 'hybrid mode'}
    </span>
  )
}
