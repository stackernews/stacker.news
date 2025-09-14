import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { $convertFromMarkdownString } from '@lexical/markdown'
import { SN_TRANSFORMERS } from '@/lib/lexical/transformers/image-markdown-transformer'
import styles from './styles/theme.module.css'
import theme from './styles/theme'
import ToolbarPlugin from './plugins/toolbar'
import OnChangePlugin from './plugins/onchange'
import CodeShikiPlugin from './plugins/codeshiki'
import { $getRoot } from 'lexical'
// import { useContext } from 'react'
// import { StorageKeyPrefixContext } from '@/components/form'
import { $createCodeNode } from '@lexical/code'
import defaultNodes from '../../lib/lexical/nodes'
import { forwardRef } from 'react'
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin'
import MediaOrLinkPlugin, { URL_MATCHERS } from './plugins/interop/media-or-link'

const onError = (error) => {
  console.error(error)
}

// I suppose we should have a Lexical for Editing and one for Reading, with style in common
// so we can have a consistent WYSIWYG styling

export function LexicalEditor ({ nodes = defaultNodes }, optionals = {}) {
  const initial = {
    namespace: 'snEditor',
    theme,
    editorState: () => {
      const root = $getRoot()
      if (root.getFirstChild() === null) {
        const codeBlock = $createCodeNode()
        codeBlock.setLanguage('markdown')
        root.append(codeBlock)
      }
    },
    onError,
    nodes
  }

  return (
    <div className={styles.editorContainer}>
      <LexicalComposer initialConfig={initial}>
        <ToolbarPlugin />
        <RichTextPlugin
          contentEditable={
            <div className={styles.editor}>
              <ContentEditable className={styles.editorInput} />
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <AutoLinkPlugin matchers={URL_MATCHERS} />
        <MediaOrLinkPlugin />
        <CodeShikiPlugin />
        <HistoryPlugin />
        <MarkdownShortcutPlugin transformers={SN_TRANSFORMERS} />
        {/* triggers all the things that should happen when the editor state changes */}
        <OnChangePlugin {...optionals} />
      </LexicalComposer>
    </div>
  )
}

export const LexicalReader = forwardRef(function LexicalReader ({ nodes = defaultNodes, className, children }, ref) {
  const [text, overflowing] = children

  const initial = {
    namespace: 'snEditor',
    editable: false,
    theme,
    editorState: () => {
      // TODO: correct theme for code nodes
      return $convertFromMarkdownString(text, SN_TRANSFORMERS)
    },
    onError,
    nodes
  }

  return (
    <div className={styles.editorContainer}>
      <LexicalComposer initialConfig={initial}>
        <RichTextPlugin
          contentEditable={
            <div className={styles.editor}>
              <ContentEditable className={className} ref={ref} />
              {overflowing}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <CodeShikiPlugin />
      </LexicalComposer>
    </div>
  )
})
