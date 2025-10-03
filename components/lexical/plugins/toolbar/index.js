import styles from '@/components/lexical/theme/theme.module.css'
import { useRef } from 'react'
import FileUploadPlugin from '../interop/fileupload'
import SwitchPlugin from './tools/switch'
import FormattingPlugin from './formatting'
import LinkTransformationPlugin from './transformations/link'
// import ZenPlugin from '../asuka/zen'

export default function ToolbarPlugin ({ anchorElem }) {
  const toolbarRef = useRef(null)

  return (
    <div className={styles.toolbar} ref={toolbarRef}>
      <FormattingPlugin />
      <LinkTransformationPlugin anchorElem={anchorElem} />
      <div className='ms-auto d-flex align-items-center'>
        {/* <ZenPlugin /> */}
        <SwitchPlugin />
        <FileUploadPlugin />
      </div>
    </div>
  )
}
