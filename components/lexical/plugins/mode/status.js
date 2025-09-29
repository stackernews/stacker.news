import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useState } from 'react'
import { $getRoot } from 'lexical'
import { $isMarkdownNode } from '@/lib/lexical/nodes/markdownnode'
import styles from '@/components/lexical/theme/theme.module.css'

export default function ModeStatusPlugin () {
  const [editor] = useLexicalComposerContext()
  const [markdownMode, setMarkdownMode] = useState(false)

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot()
        const firstChild = root.getFirstChild()
        console.log('firstChild', firstChild)
        const isMarkdownMode = $isMarkdownNode(firstChild)
        console.log('isMarkdownMode', isMarkdownMode)
        setMarkdownMode(isMarkdownMode)
      })
    })
  }, [editor])

  return (
    <span className={styles.modeStatus}>{markdownMode ? 'Markdown Mode' : 'WYSIWYG Mode'}</span>
  )
}
