import LayoutCenter from '../components/layout-center'
import styles from '../lexical/styles.module.css'

import Theme from '../lexical/theme'
import ListMaxIndentLevelPlugin from '../lexical/plugins/list-max-indent'
import AutoLinkPlugin from '../lexical/plugins/autolink'
import ToolbarPlugin from '../lexical/plugins/toolbar'
import LinkTooltipPlugin from '../lexical/plugins/link-tooltip'

import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { useState } from 'react'
import LinkInsertPlugin, { LinkInsertProvider } from '../lexical/plugins/link-insert'
import { ImageNode } from '../lexical/nodes/image'
import ImageInsertPlugin from '../lexical/plugins/image-insert'
import { SN_TRANSFORMERS } from '../lexical/utils/image-markdown-transformer'
import { $convertToMarkdownString, $convertFromMarkdownString } from '@lexical/markdown'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import Text from '../components/text'
import { Button } from 'react-bootstrap'

const editorConfig = {
  // The editor theme
  theme: Theme,
  // Handling of errors during update
  onError (error) {
    throw error
  },
  // Any custom nodes go here
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
    HorizontalRuleNode,
    ImageNode
  ]
}

function Editor ({ markdown }) {
  const [floatingAnchorElem, setFloatingAnchorElem] = useState(null)

  const onRef = (_floatingAnchorElem) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem)
    }
  }

  let initialConfig = editorConfig
  if (markdown) {
    initialConfig = { ...initialConfig, editorState: () => $convertFromMarkdownString(markdown, SN_TRANSFORMERS) }
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={styles.editorContainer}>
        <div className={styles.editorInner}>
          <LinkInsertProvider>
            <ToolbarPlugin />
            <LinkTooltipPlugin anchorElem={floatingAnchorElem} />
            <LinkInsertPlugin />
          </LinkInsertProvider>
          <RichTextPlugin
            contentEditable={
              <div className={styles.editor} ref={onRef}>
                <ContentEditable className={styles.editorInput} />
              </div>
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <ImageInsertPlugin />
          <AutoFocusPlugin />
          <ListPlugin />
          <LinkPlugin />
          <AutoLinkPlugin />
          <HistoryPlugin />
          <ListMaxIndentLevelPlugin maxDepth={4} />
          <MarkdownShortcutPlugin transformers={SN_TRANSFORMERS} />
        </div>
      </div>
      {!markdown && <Markdown />}
    </LexicalComposer>
  )
}

function Markdown () {
  const [editor] = useLexicalComposerContext()
  const [markdown, setMarkdown] = useState(null)
  const [preview, togglePreview] = useState(true)

  return (
    <>
      <div className='lexical text-left w-100'>
        <OnChangePlugin onChange={() => editor.update(() => {
          setMarkdown($convertToMarkdownString(SN_TRANSFORMERS))
        })}
        />
        <Button size='sm' className='mb-2' onClick={() => togglePreview(!preview)}>{preview ? 'show markdown' : 'show preview'}</Button>
        <div style={{ border: '1px solid var(--theme-color)', padding: '.5rem', borderRadius: '.4rem' }}>

          {preview
            ? (
              <Text>
                {markdown}
              </Text>
              )
            : (
              <pre className='text-reset p-0 m-0'>
                {markdown}
              </pre>
              )}
        </div>
      </div>
    </>
  )
}

export default function Lexical () {
  return (
    <LayoutCenter footerLinks>
      <Editor />
    </LayoutCenter>
  )
}
