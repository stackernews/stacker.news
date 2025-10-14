import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import styles from '@/components/lexical/theme/theme.module.css'
import theme from '../theme'
import CodeShikiPlugin from '../plugins/code'
import DefaultNodes from '@/lib/lexical/nodes'
import { forwardRef } from 'react'
import classNames from 'classnames'

export default forwardRef(function Reader ({ lexicalState, customNodes = [], topLevel, className, children, contentRef }, ref) {
  const initial = {
    editorState: (editor) => {
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
    namespace: 'SNReader',
    editable: false,
    nodes: [...DefaultNodes, ...customNodes],
    onError: (error) => {
      console.error(error)
    },
    theme: {
      ...theme,
      topLevel: topLevel || false
    }
  }

  return (
    <LexicalComposer initialConfig={initial}>
      <RichTextPlugin
        contentEditable={
          <div className={classNames(styles.editor, className)} ref={contentRef}>
            <ContentEditable />
            {children}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <CodeShikiPlugin />
    </LexicalComposer>
  )
})
