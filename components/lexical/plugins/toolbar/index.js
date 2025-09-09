import styles from '../../theme.module.css'
import { useRef } from 'react'
import FileUploadPlugin from './fileupload'
import SwitchPlugin from './switch'
import FormattingPlugin from './formatting'

export default function ToolbarPlugin () {
  const toolbarRef = useRef(null)

  return (
    <div className={styles.toolbar} ref={toolbarRef}>
      <FormattingPlugin />
      <div className='ms-auto d-flex align-items-center'>
        <SwitchPlugin />
        <FileUploadPlugin />
      </div>
    </div>
  )
}
