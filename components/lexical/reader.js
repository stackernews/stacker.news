import { defineExtension } from 'lexical'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { forwardRef, useMemo } from 'react'
import classNames from 'classnames'
import DefaultNodes from '@/lib/lexical/nodes'
import { LexicalItemContextProvider } from './contexts/item'
import { CodeShikiSNExtension, CodeThemePlugin } from './plugins/core/code'
import styles from './theme/theme.module.css'
import theme from './theme'
import CodeActionsPlugin from './plugins/decorative/codeactions'

export default forwardRef(function Reader ({ lexicalState, topLevel, className, children, contentRef, imgproxyUrls, outlawed, rel }, ref) {
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
      theme
    }), [])

  return (
    <LexicalExtensionComposer extension={reader} contentEditable={null}>
      <LexicalItemContextProvider imgproxyUrls={imgproxyUrls} topLevel={topLevel} outlawed={outlawed} rel={rel}>
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
        {contentRef && <CodeActionsPlugin anchorElem={contentRef.current} />}
      </LexicalItemContextProvider>
    </LexicalExtensionComposer>
  )
})
