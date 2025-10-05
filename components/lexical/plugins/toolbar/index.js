import styles from '@/components/lexical/theme/theme.module.css'
import { useRef } from 'react'
import InsertTools from './insert'
import FormattingTools from './formatting'
import LinkTransformationPlugin from '../tools/link'
// import ZenPlugin from '../asuka/zen'

export default function ToolbarPlugin ({ anchorElem }) {
  const toolbarRef = useRef(null)

  return (
    <>
      <div className={styles.toolbar} ref={toolbarRef}>
        <FormattingTools />
        <div className='ms-auto d-flex align-items-center'>
          <InsertTools />
        </div>
      </div>
      <LinkTransformationPlugin anchorElem={anchorElem} />
    </>

  )
}
