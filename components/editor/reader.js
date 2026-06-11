import { useMemo } from 'react'
import { defineExtension } from 'lexical'
import { RichTextExtension } from '@lexical/rich-text'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { TableExtension } from '@lexical/table'
import { CodeShikiSNExtension } from '@/lib/lexical/exts/shiki'
import { CodeThemePlugin } from './plugins/core/code-theme'
import DefaultNodes from '@/lib/lexical/nodes'
import { markdownToLexical } from '@/lib/lexical/utils/mdast'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { GalleryExtension } from '@/lib/lexical/exts/gallery'
import { AutoLinkExtension } from '@/lib/lexical/exts/autolink'
import NextLinkPlugin from './plugins/patch/next-link'
import { MuteLexicalExtension } from '@/lib/lexical/exts/mute-lexical'
import theme from '@/lib/lexical/theme'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { withDOM } from '@/lib/lexical/server/dom'
import { generateHTML } from '@/lib/lexical/server/html'

// prioritize server-resolved HTML, otherwise generate it from the editor state
// in SSR we generate it in a fake DOM
const initialContentEditable = (editor, html) => {
  if (typeof window === 'undefined') {
    return html || withDOM(() => generateHTML(editor))
  }
  return html || generateHTML(editor)
}

const initiateEditorState = (editor, state, text) => {
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

function SSRContentEditable ({ html, ...props }) {
  const [editor] = useLexicalComposerContext()

  const initialHTML = useMemo(() => initialContentEditable(editor, html), [editor, html])

  return (
    <ContentEditable
      {...props}
      suppressHydrationWarning
      // server HTML is preserved until ContentEditable attaches the root element,
      // which repaints it from the editor state before the browser paints
      dangerouslySetInnerHTML={{ __html: initialHTML }}
    />
  )
}

export default function Reader ({ topLevel, state, text, html, readerRef, innerClassName }) {
  const reader = useMemo(() =>
    defineExtension({
      name: 'reader',
      namespace: 'sn-rich',
      editable: false,
      nodes: DefaultNodes,
      dependencies: [
        RichTextExtension,
        TableExtension,
        CodeShikiSNExtension,
        AutoLinkExtension,
        GalleryExtension,
        MuteLexicalExtension
      ],
      theme: {
        ...theme,
        topLevel: topLevel && 'topLevel'
      },
      $initialEditorState: (editor) => {
        if (typeof window === 'undefined' && html) return
        initiateEditorState(editor, state, text)
      },
      onError: (error) => console.error('reader has encountered an error:', error)
    }), [topLevel, state, html, text])

  const contentEditable = useMemo(() => (
    <SSRContentEditable html={html} data-sn-reader='true' className={innerClassName} />
  ), [html, innerClassName])

  return (
    <LexicalExtensionComposer extension={reader} contentEditable={contentEditable}>
      <EditorRefPlugin editorRef={readerRef} />
      <CodeThemePlugin />
      <NextLinkPlugin />
    </LexicalExtensionComposer>
  )
}
