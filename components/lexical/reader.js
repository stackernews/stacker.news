import { defineExtension } from 'lexical'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { forwardRef, useMemo } from 'react'
import classNames from 'classnames'
import DefaultNodes from '@/lib/lexical/nodes'
import { CodeShikiSNExtension, CodeThemePlugin } from './extensions/core/code'
import styles from './theme/theme.module.css'
import theme from './theme'

export default forwardRef(function Reader ({ lexicalState, className, children, contentRef }, ref) {
  const reader = useMemo(() =>
    defineExtension({
      $initialEditorState: (editor) => {
        if (!lexicalState) return
        try {
          const state = editor.parseEditorState(lexicalState)
          if (!state.isEmpty()) {
            editor.setEditorState(state)
          }
        } catch (error) {
          console.error('cant load initial state:', error)
        }
      },
      name: 'reader',
      namespace: 'SN',
      editable: false,
      nodes: DefaultNodes,
      dependencies: [CodeShikiSNExtension],
      theme,
      onError: (error) => console.error('stacker news reader has encountered an error:', error)
    }), [])

  return (
    <LexicalExtensionComposer extension={reader} contentEditable={null}>
      <RichTextPlugin
        contentEditable={
          <div className={classNames(styles.editor, className)} ref={contentRef}>
            <ContentEditable />
            {children}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <CodeThemePlugin />
    </LexicalExtensionComposer>
  )
})
