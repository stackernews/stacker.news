import { useMemo } from 'react'
import { defineExtension, configExtension } from 'lexical'
import { RichTextExtension } from '@lexical/rich-text'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { ReactExtension } from '@lexical/react/ReactExtension'
import { TableExtension } from '@lexical/table'
import theme from '../../lib/lexical/theme'
import { CodeShikiSNExtension } from '@/lib/lexical/exts/shiki'
import { CodeThemePlugin } from './plugins/core/code-theme'
import DefaultNodes from '@/lib/lexical/nodes'
import { markdownToLexical } from '@/lib/lexical/utils/mdast'
import PreviewSyncPlugin from './plugins/core/previewsync'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'

const initiateLexical = (editor, state, text) => {
  if (text) {
    markdownToLexical(editor, text)
    return
  }

  if (state) {
    try {
      const lexicalState = editor.parseEditorState(state)

      if (!lexicalState.isEmpty()) {
        editor.setEditorState(lexicalState)
      }
    } catch (error) {
      console.error(error)
    }
  }
}

export default function Reader ({ topLevel, state, text, readerRef }) {
  const reader = useMemo(() =>
    defineExtension({
      name: 'reader',
      namespace: 'sn',
      editable: false,
      nodes: DefaultNodes,
      dependencies: [
        RichTextExtension,
        TableExtension,
        CodeShikiSNExtension,
        configExtension(ReactExtension, { contentEditable: null })
      ],
      theme: {
        ...theme,
        topLevel: topLevel && 'sn-text--top-level'
      },
      $initialEditorState: (editor) => initiateLexical(editor, state, text),
      onError: (error) => console.error('reader has encountered an error:', error)
    }), [topLevel])

  return (
    <LexicalExtensionComposer extension={reader} contentEditable={null}>
      <EditorRefPlugin editorRef={readerRef} />
      <ContentEditable />
      <PreviewSyncPlugin text={text} />
      <CodeThemePlugin />
    </LexicalExtensionComposer>
  )
}
