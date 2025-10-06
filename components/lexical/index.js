import { LexicalPreferencesContextProvider } from '@/components/lexical/contexts/preferences'
import dynamic from 'next/dynamic'
import styles from './theme/theme.module.css'
import classNames from 'classnames'

// messy way to show a skeleton while the editor is loading
const EditorSkeleton = () => {
  return (
    <div className={styles.editorContainer} style={{ marginBottom: '23px' }}>
      <div className={classNames(styles.toolbar, styles.skeleton)}>
        <div className={styles.toolbarFormatting} style={{ height: '28px', width: '100%' }}>
          <span className={`${styles.otherItem} clouds`} />
        </div>
      </div>
      <div className={styles.editorInput} contentEditable='true'>
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

const Editor = dynamic(() => import('@/components/lexical/editor'), { ssr: false, loading: EditorSkeleton })
// maybe the reader can use the HTML as a skeleton, instead of relying on useEffect
const Reader = dynamic(() => import('@/components/lexical/reader'), { ssr: false })

// lexical starting point, can be a reader or an editor
export default function SNLexical ({ reader = false, ...props }) {
  return (
    <LexicalPreferencesContextProvider>
      {reader
        ? <Reader {...props} />
        : <Editor {...props} />}
    </LexicalPreferencesContextProvider>
  )
}
