import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import styles from '@/components/lexical/theme/theme.module.css'
import AddIcon from '@/svgs/add-fill.svg'
import { INSERT_OPTIONS } from './defs/formatting'
import { ToolbarDropdown } from './index'

export default function InsertTools () {
  const [editor] = useLexicalComposerContext()

  return (
    <ToolbarDropdown
      icon={<AddIcon />}
      tooltip='insert options'
      options={INSERT_OPTIONS}
      arrow={false}
      className={styles.toolbarInsert}
      editor={editor}
    />
  )
}
