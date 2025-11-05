import { defineExtension } from 'lexical'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { forwardRef, useMemo } from 'react'
import DefaultNodes from '@/lib/lexical/nodes'
import { CodeShikiSNExtension } from '../../lib/lexical/extensions/core/code'
import { CodeThemePlugin } from './plugins/core/code-theme'
import theme from './theme'
import { TableExtension } from '@lexical/table'
import classNames from 'classnames'

export default forwardRef(function Reader ({ lexicalState, className, children, contentRef, topLevel }, ref) {
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
      dependencies: [CodeShikiSNExtension, TableExtension],
      theme,
      onError: (error) => console.error('stacker news reader has encountered an error:', error)
    }), [])

  return (
    <LexicalExtensionComposer extension={reader} contentEditable={null}>
      <div style={{ position: 'relative' }}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable className={classNames(className, topLevel && 'topLevel')} ref={contentRef} />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {children}
      </div>
      <CodeThemePlugin />
    </LexicalExtensionComposer>
  )
})
