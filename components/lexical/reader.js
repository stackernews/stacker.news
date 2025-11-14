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
import CodeActionsPlugin from './plugins/decorative/code-actions'
// import { FootnotesExtension } from '@/lib/lexical/extensions/formatting/footnotes'

/**
 * Lexical Renderer: renders lexical state as read-only content
 * @param {string} props.lexicalState - serialized lexical editor state to display
 * @param {string} [props.className] - additional CSS class names
 * @param {React.ReactNode} [props.children] - child components
 * @param {React.Ref} [props.contentRef] - ref for content editable element
 * @param {React.Ref} ref - forwarded ref
 * @returns {JSX.Element} lexical renderer
 */
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
      dependencies: [CodeShikiSNExtension, TableExtension], // , FootnotesExtension
      theme: { ...theme, topLevel: topLevel ? 'topLevel' : '' },
      onError: (error) => console.error('stacker news reader has encountered an error:', error)
    }), [topLevel])

  return (
    <LexicalExtensionComposer extension={reader} contentEditable={null}>
      <div style={{ position: 'relative' }}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable className={className} ref={contentRef} />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {children}
      </div>
      <CodeThemePlugin />
      <CodeActionsPlugin anchorElem={contentRef.current} />
    </LexicalExtensionComposer>
  )
})
