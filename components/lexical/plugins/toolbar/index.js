import styles from '@/components/lexical/theme/theme.module.css'
import { useRef } from 'react'
import InsertTools from './insert'
import FormattingTools from './formatting'
import LinkTransformationPlugin from '../links/transformator'
import classNames from 'classnames'

export default function ToolbarPlugin ({ anchorElem, isFloating }) {
  const toolbarRef = useRef(null)

  return isFloating
    ? (
      <>
        <div className={classNames(styles.toolbar, styles.floating)} ref={toolbarRef}>
          <FormattingTools isFloating />
        </div>
      </>
      )
    : (
      <>
        <div className={styles.toolbar} ref={toolbarRef}>
          <FormattingTools />
          <div className='ms-auto d-flex align-items-center'>
            {!isFloating && (
              <>
                <span className={styles.snPreview}>PREVIEW</span>
                <span className={styles.divider} />
              </>
            )}
            <InsertTools />
          </div>
        </div>
        <LinkTransformationPlugin anchorElem={anchorElem} />
      </>
      )
}
