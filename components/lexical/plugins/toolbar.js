import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import styles from '../theme.module.css'
import { useRef } from 'react'
import FileUploadPlugin from './fileupload'
import SwitchPlugin from './switch'

export default function ToolbarPlugin () {
  const [editor] = useLexicalComposerContext()
  const toolbarRef = useRef(null)

  return (
    <div className={styles.toolbar} ref={toolbarRef}>
      <button className={styles.toolbarButton}>
        bold
      </button>

      <div className='ms-auto d-flex align-items-center'>
        <SwitchPlugin />
        <FileUploadPlugin />
      </div>
    </div>
  )
}
