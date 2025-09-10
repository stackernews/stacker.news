import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { TRANSFORMERS, $convertFromMarkdownString } from '@lexical/markdown'
import styles from './theme.module.css'
import theme from './theme'
import ToolbarPlugin from './plugins/toolbar'
import OnChangePlugin from './plugins/onchange'
import CodeShikiPlugin from './plugins/codeshiki'
import { $getRoot } from 'lexical'
// import { useContext } from 'react'
// import { StorageKeyPrefixContext } from '@/components/form'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode, $createCodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'

const onError = (error) => {
  console.error(error)
}

export function Lexical ({ name, placeholder = 'hm?' }) {
  // wip - proof of concept of using storageKeyPrefixContext
  // const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  // const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined

  const initial = {
    namespace: 'snEditor',
    theme,
    onError,
    editorState: () => {
      const root = $getRoot()
      if (root.getFirstChild() === null) {
        const codeBlock = $createCodeNode()
        codeBlock.setLanguage('markdown')
        codeBlock.setTheme('github-dark-default')
        root.append(codeBlock)
      }
    },
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      AutoLinkNode,
      LinkNode,
      HorizontalRuleNode
    ]
  }

  return (
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
      <CodeShikiPlugin />
      <HistoryPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      {/* triggers all the things that should happen when the editor state changes */}
      <OnChangePlugin />
    </LexicalComposer>
  )
}

// I suppose we should have a Lexical for Editing and one for Reading, with style in common
// so we can have a consistent WYSIWYG styling

export function LexicalEditor ({ nodes = [] }) {
  const initial = {
    namespace: 'snEditor',
    theme,
    editorState: () => {
      const root = $getRoot()
      if (root.getFirstChild() === null) {
        const codeBlock = $createCodeNode()
        codeBlock.setLanguage('markdown')
        codeBlock.setTheme('github-dark-default')
        root.append(codeBlock)
      }
    },
    onError: (error) => {
      console.error(error)
    },
    nodes
  }

  return (
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
      <CodeShikiPlugin />
      <HistoryPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      {/* triggers all the things that should happen when the editor state changes */}
      <OnChangePlugin />
    </LexicalComposer>
  )
}

export function LexicalReader ({ nodes = [], className, children }) {
  const initial = {
    namespace: 'snEditor',
    editable: false,
    theme,
    editorState: () => {
      // TODO: correct theme for code nodes
      return $convertFromMarkdownString(children, TRANSFORMERS)
    },
    onError: (error) => {
      console.error(error)
    },
    nodes
  }

  return (
    <LexicalComposer initialConfig={initial}>
      <RichTextPlugin
        contentEditable={
          <div className={styles.editor}>
            <ContentEditable className={className} />
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
    </LexicalComposer>
  )
}
