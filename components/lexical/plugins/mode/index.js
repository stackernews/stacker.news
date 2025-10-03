import ModeStatusPlugin from './status'
import SwitchPlugin from './switch'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useState, useEffect } from 'react'
import { $getRoot } from 'lexical'
import { $isMarkdownNode } from '@/lib/lexical/nodes/markdownnode'

export default function ModePlugins () {
  const markdownMode = $useMarkdownMode()
  return (
    <>
      <SwitchPlugin markdownMode={markdownMode} />
      <ModeStatusPlugin markdownMode={markdownMode} />
    </>
  )
}

export function $useMarkdownMode () {
  const [editor] = useLexicalComposerContext()
  if (!editor) return false
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

  return markdownMode
}
