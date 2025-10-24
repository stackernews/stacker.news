import { forwardRef, useMemo } from 'react'
import classNames from 'classnames'
import dynamic from 'next/dynamic'
import { applySNCustomizations } from '@/lib/lexical/html/customs'
import styles from './theme/theme.module.css'
import { useRouter } from 'next/router'
import { LexicalPreferencesContextProvider } from './contexts/preferences'
import { LexicalItemContextProvider } from './contexts/item'

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

export const LexicalEditor = ({ ...props }) => {
  const Editor = useMemo(() => dynamic(() => import('./editor'), {
    ssr: false,
    loading: EditorSkeleton
  }), [])

  return (
    <LexicalPreferencesContextProvider>
      <Editor {...props} />
    </LexicalPreferencesContextProvider>
  )
}

export const LexicalReader = forwardRef(function LexicalReader ({ html, children, outlawed, imgproxyUrls, topLevel, rel, ...props }, ref) {
  const router = useRouter()
  const snCustomizedHTML = useMemo(() => applySNCustomizations(html, { outlawed, imgproxyUrls, topLevel }), [html, outlawed, imgproxyUrls, topLevel])
  // debug html with ?html
  if (router.query.html) return <div className={props.className} dangerouslySetInnerHTML={{ __html: snCustomizedHTML }} />

  const Reader = useMemo(() => dynamic(() => import('./reader'), {
    ssr: false,
    loading: () => {
      if (snCustomizedHTML) {
        return (
          <div className={props.className} ref={ref}>
            <div dangerouslySetInnerHTML={{ __html: snCustomizedHTML }} />
            {children}
          </div>
        )
      }
      return null
    }
  }), [])

  return (

    <LexicalItemContextProvider imgproxyUrls={imgproxyUrls} topLevel={topLevel} outlawed={outlawed} rel={rel}>
      <Reader {...props} contentRef={ref}>
        {children}
      </Reader>
    </LexicalItemContextProvider>
  )
})
