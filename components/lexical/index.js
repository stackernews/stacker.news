import dynamic from 'next/dynamic'
import styles from './theme/theme.module.css'
import classNames from 'classnames'
import { forwardRef, useMemo } from 'react'

// messy way to show a skeleton while the editor is loading
const EditorSkeleton = () => {
  return (
    <div className={styles.editorContainer} style={{ marginBottom: '23px' }}>
      <div className={classNames(styles.toolbar, styles.skeleton)}>
        <div className={styles.toolbarFormatting} style={{ height: '28px', width: '100%' }}>
          <span className={`${styles.otherItem} clouds`} />
        </div>
      </div>
      <div className={styles.editorInput}>
        <div className={classNames(styles.skeleton, styles.otherItem)} style={{ height: '10px', width: '140px', marginTop: '5px' }}>
          <span className={`${styles.otherItem} clouds`} />
        </div>
      </div>
      <div className={styles.modeStatus} style={{ height: '10px', width: '70px', marginTop: '5px' }}>
        <span className={classNames(styles.skeleton, styles.otherItem)}>
          <span className={`${styles.otherItem} clouds`} />
        </span>
      </div>
    </div>
  )
}

// lexical starting point, can be a reader or an editor
export const LexicalEditor = forwardRef(function LexicalEditor ({ ...props }, ref) {
  const Editor = dynamic(() => import('@/components/lexical/editor'), { ssr: false, loading: EditorSkeleton })
  return (
    <Editor {...props} ref={ref} />
  )
})

export const LexicalReader = forwardRef(function LexicalReader ({ html, children, ...props }, ref) {
  const Reader = useMemo(() => dynamic(() => import('@/components/lexical/reader'), {
    ssr: false,
    loading: () => {
      if (html) {
        return (
          <div className={props.className} ref={ref}>
            <div className={styles.html} dangerouslySetInnerHTML={{ __html: html }} />
            {children}
          </div>
        )
      }
      return null
    }
  }), [])
  return (
    <Reader {...props} contentRef={ref}>
      {children}
    </Reader>
  )
})
