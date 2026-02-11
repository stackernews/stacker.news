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
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { GalleryExtension } from '@/lib/lexical/exts/gallery'
import { AutoLinkExtension } from '@/lib/lexical/exts/autolink'
import NextLinkPlugin from './plugins/links'
import { MuteLexicalExtension } from '@/lib/lexical/exts/mute-lexical'

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

export default function Reader ({ topLevel, state, text, readerRef, innerClassName }) {
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
        AutoLinkExtension,
        GalleryExtension,
        MuteLexicalExtension,
        configExtension(ReactExtension, { contentEditable: null })
      ],
      theme: {
        ...theme,
        topLevel: topLevel && 'topLevel'
      },
      $initialEditorState: (editor) => initiateLexical(editor, state, text),
      onError: (error) => console.error('reader has encountered an error:', error)
    }), [topLevel, state, text])

  return (
    <LexicalExtensionComposer extension={reader} contentEditable={null}>
      <EditorRefPlugin editorRef={readerRef} />
      <ContentEditable
        data-sn-reader='true'
        className={innerClassName}
      />
      <CodeThemePlugin />
      <NextLinkPlugin />
    </LexicalExtensionComposer>
  )
}
