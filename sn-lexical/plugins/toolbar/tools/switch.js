import styles from '@/sn-lexical/theme/theme.module.css'
import WYSIWYGIcon from '@/svgs/file-text-line.svg'
import MarkdownIcon from '@/svgs/markdown-line.svg'
import { useState, useCallback, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $isCodeNode, $createCodeNode } from '@lexical/code'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { SN_TRANSFORMERS } from '@/lib/lexical/transformers/image-markdown-transformer'
import { $createTextNode, $getRoot } from 'lexical'

// this will switch between wysiwyg and markdown mode
// default is markdown
export default function SwitchPlugin () {
  const [editor] = useLexicalComposerContext()
  const [markdownMode, setMarkdownMode] = useState(null)

  const getState = useCallback(() => {
    const root = $getRoot()
    const firstChild = root.getFirstChild()
    return $isCodeNode(firstChild) && firstChild.getLanguage() === 'markdown'
  }, [])

  const isMarkdownMode = useCallback(() => {
    return editor.read(() => {
      return getState()
    })
  }, [editor])

  useEffect(() => {
    setMarkdownMode(isMarkdownMode())
  }, [editor, isMarkdownMode])

  // add switch logic for lexical here, for now it doesn't do anything

  const handleMarkdownSwitch = useCallback(() => {
    editor.update(() => {
      const root = $getRoot()
      const firstChild = root.getFirstChild()
      const isMarkdownMode = $isCodeNode(firstChild) && firstChild.getLanguage() === 'markdown'
      if (isMarkdownMode) {
        setMarkdownMode(false)
        $convertFromMarkdownString(firstChild.getTextContent(), SN_TRANSFORMERS, undefined, true)
      } else {
        setMarkdownMode(true)
        const markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
        const codeNode = $createCodeNode('markdown')
        codeNode.setTheme('github-dark-default')
        codeNode.append($createTextNode(markdown))
        root.clear().append(codeNode)
        if (markdown.length === 0) codeNode.select()
      }
    })
  }, [editor])

  return (
    <div className={styles.markdownSwitch} onClick={handleMarkdownSwitch}>
      {markdownMode ? <WYSIWYGIcon width={18} height={18} /> : <MarkdownIcon width={18} height={18} />}
    </div>
  )
}
