import styles from '../../theme.module.css'
import WYSIWYGIcon from '@/svgs/file-text-line.svg'
import MarkdownIcon from '@/svgs/markdown-line.svg'
import { useState, useCallback } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $isCodeNode, $createCodeNode } from '@lexical/code'
import { TRANSFORMERS, $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $createTextNode, $getRoot } from 'lexical'

// this will switch between wysiwyg and markdown mode
// default is markdown
export default function SwitchPlugin () {
  const [editor] = useLexicalComposerContext()
  const [markdownMode, setMarkdownMode] = useState(false)

  // add switch logic for lexical here, for now it doesn't do anything

  const handleMarkdownSwitch = useCallback(() => {
    editor.update(() => {
      const root = $getRoot()
      const firstChild = root.getFirstChild()
      if ($isCodeNode(firstChild) && firstChild.getLanguage() === 'markdown') {
        setMarkdownMode(false)
        $convertFromMarkdownString(firstChild.getTextContent(), TRANSFORMERS, undefined, true)
      } else {
        setMarkdownMode(true)
        const markdown = $convertToMarkdownString(TRANSFORMERS, undefined, true)
        const codeNode = $createCodeNode('markdown')
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
