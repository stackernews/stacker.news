import styles from '@/components/lexical/styles/theme.module.css'
import { useRef } from 'react'
import FileUploadPlugin from './tools/fileupload'
import SwitchPlugin from './tools/switch'
import FormattingPlugin from './formatting'
// import ZenPlugin from '../asuka/zen'

export default function ToolbarPlugin ({ setPreviewHtml }) {
  const toolbarRef = useRef(null)

  return (
    <div className={styles.toolbar} ref={toolbarRef}>
      <FormattingPlugin />
      <div className='ms-auto d-flex align-items-center'>
        {/* <ZenPlugin /> */}
        <SwitchPlugin />
        <FileUploadPlugin />
      </div>
    </div>
  )
}
