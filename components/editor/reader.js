import { forwardRef, useMemo } from 'react'
import { defineExtension, configExtension } from 'lexical'
import { RichTextExtension } from '@lexical/rich-text'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { ReactExtension } from '@lexical/react/ReactExtension'
import { TableExtension } from '@lexical/table'
import theme from './theme'
import { CodeShikiSNExtension } from '@/lib/lexical/exts/shiki'
import { CodeThemePlugin } from './plugins/code-theme'
import DefaultNodes from '@/lib/lexical/nodes'
import { setMarkdown } from '@/lib/lexical/utils/mdast'

const initiateLexical = (editor, lexicalState, markdown) => {
  if (markdown) {
    setMarkdown(editor, markdown)
    return
  }

  if (lexicalState) {
    try {
      const state = editor.parseEditorState(lexicalState)

      if (!state.isEmpty()) {
        editor.setEditorState(state)
      }
    } catch (error) {
      console.error(error)
    }
  }
}

export default forwardRef(function Reader ({ className, contentRef, topLevel, lexicalState, markdown, children }, ref) {
  const reader = useMemo(() =>
    defineExtension({
      name: 'reader',
      namespace: 'sn',
      editable: false,
      nodes: DefaultNodes,
      dependencies: [
        RichTextExtension,
        TableExtension,
        CodeShikiSNExtension,
        configExtension(ReactExtension, { contentEditable: null })
      ],
      theme: {
        ...theme,
        topLevel: topLevel && 'sn__topLevel'
      },
      $initialEditorState: (editor) => initiateLexical(editor, lexicalState, markdown),
      onError: (error) => console.error(error)
    }), [topLevel, markdown])

  return (
    <LexicalExtensionComposer extension={reader} contentEditable={null}>
      <div style={{ position: 'relative' }}>
        <ContentEditable className={className} ref={contentRef} />
        {children}
      </div>
      <CodeThemePlugin />
    </LexicalExtensionComposer>
  )
})
