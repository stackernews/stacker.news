import styles from '@/components/lexical/theme/theme.module.css'
import WYSIWYGIcon from '@/svgs/file-text-line.svg'
import MarkdownIcon from '@/svgs/markdown-line.svg'
import { useState, useCallback, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $createTextNode, $getRoot } from 'lexical'
import { $isMarkdownNode, $createMarkdownNode } from '@/lib/lexical/nodes/markdownnode'

// this will switch between wysiwyg and markdown mode
// default is markdown
export default function SwitchPlugin () {
  const [editor] = useLexicalComposerContext()
  const [markdownMode, setMarkdownMode] = useState(null)

  const getState = useCallback(() => {
    const root = $getRoot()
    const firstChild = root.getFirstChild()
    return $isMarkdownNode(firstChild)
  }, [])

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setMarkdownMode(getState())
      })
    })
  }, [editor, getState])

  const handleMarkdownSwitch = useCallback(() => {
    editor.update(() => {
      const root = $getRoot()
      const firstChild = root.getFirstChild()
      if (markdownMode) {
        setMarkdownMode(false)
        // bypass markdown node removal protection
        if (typeof firstChild.bypassProtection === 'function') firstChild.bypassProtection()
        $convertFromMarkdownString(firstChild.getTextContent(), SN_TRANSFORMERS, undefined, true)
      } else {
        setMarkdownMode(true)
        const markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
        const codeNode = $createMarkdownNode()
        codeNode.append($createTextNode(markdown))
        root.clear().append(codeNode)
        if (markdown.length === 0) codeNode.select()
      }
    }, { tag: 'sn-mode-switch' })
  }, [editor, markdownMode])

  return (
    <div className={styles.markdownSwitch} onClick={handleMarkdownSwitch}>
      {markdownMode ? <WYSIWYGIcon width={18} height={18} /> : <MarkdownIcon width={18} height={18} />}
    </div>
  )
}
