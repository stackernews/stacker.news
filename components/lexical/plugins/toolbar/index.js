import styles from '@/components/lexical/theme/theme.module.css'
import { useRef } from 'react'
import InsertTools from './insert'
import FormattingTools from './formatting'
import LinkTransformationPlugin from '../links/transformator'

export default function ToolbarPlugin ({ anchorElem }) {
  const toolbarRef = useRef(null)

  return (
    <>
      <div className={styles.toolbar} ref={toolbarRef}>
        <FormattingTools />
        <div className='ms-auto d-flex align-items-center'>
          <span className={styles.snPreview}>PREVIEW</span>
          <span className={styles.divider} />
          <InsertTools />
        </div>
      </div>
      <LinkTransformationPlugin anchorElem={anchorElem} />
    </>

  )
}
