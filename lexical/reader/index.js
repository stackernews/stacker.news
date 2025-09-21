import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import styles from '@/lexical/theme/theme.module.css'
import theme from '../theme'
import CodeShikiPlugin from '../plugins/codeshiki'
import DefaultNodes from '@/lib/lexical/nodes'
import { forwardRef } from 'react'

export default forwardRef(function Reader ({ lexicalState, customNodes = [], topLevel, className, children }, ref) {
  const initial = {
    editorState: (editor) => {
      const state = editor.parseEditorState(lexicalState)
      editor.setEditorState(state)
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
          <div className={styles.editor}>
            <ContentEditable className={className} ref={ref} />
            {children}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <CodeShikiPlugin />
    </LexicalComposer>
  )
})
