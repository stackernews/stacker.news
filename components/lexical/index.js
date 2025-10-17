import { forwardRef, useMemo } from 'react'
import classNames from 'classnames'
import dynamic from 'next/dynamic'
import styles from './theme/theme.module.css'

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
      <div className={styles.bottomBarItem} style={{ height: '10px', width: '70px', marginTop: '5px' }}>
        <span className={classNames(styles.skeleton, styles.otherItem)}>
          <span className={`${styles.otherItem} clouds`} />
        </span>
      </div>
    </div>
  )
}

// Editor is dynamically imported outside of the component to avoid parents causing re-renders
const Editor = dynamic(() => import('@/components/lexical/editor'), { ssr: false, loading: EditorSkeleton })

export const LexicalEditor = forwardRef(function LexicalEditor ({ ...props }, ref) {
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
