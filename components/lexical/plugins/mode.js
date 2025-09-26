import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useState } from 'react'
import { $getRoot } from 'lexical'
import { $isCodeNode } from '@lexical/code'
import styles from '@/components/lexical/theme/theme.module.css'

export default function ModePlugin () {
  const [editor] = useLexicalComposerContext()
  const [markdownMode, setMarkdownMode] = useState(false)

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot()
        const firstChild = root.getFirstChild()
        const isMarkdownMode = $isCodeNode(firstChild) && firstChild.getLanguage() === 'markdown'
        console.log('isMarkdownMode', isMarkdownMode)
        setMarkdownMode(isMarkdownMode)
      })
    })
  }, [editor])

  return (
    <span className={styles.mode}>{markdownMode ? 'Markdown Mode' : 'WYSIWYG Mode'}</span>
  )
}
