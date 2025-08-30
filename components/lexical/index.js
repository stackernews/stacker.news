import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { TRANSFORMERS } from '@lexical/markdown'
import styles from './theme.module.css'
import theme from './theme'
import ToolbarPlugin from './plugins/toolbar'
import OnChangePlugin from './plugins/onchange'
import { useContext } from 'react'
import { StorageKeyPrefixContext } from '@/components/form'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'

const onError = (error) => {
  console.error(error)
}

export function Lexical ({ name }) {
  // wip - proof of concept of using storageKeyPrefixContext
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined

  const initial = {
    namespace: 'snEditor',
    theme,
    onError,
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

  // saves the editor state to local storage
  function onChange (editorState) {
    const json = editorState.toJSON()
    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(json))
    }
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
      <HistoryPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <AutoFocusPlugin />
      {/* saves the editor state to local storage */}
      <OnChangePlugin onChange={onChange} />
    </LexicalComposer>
  )
}
