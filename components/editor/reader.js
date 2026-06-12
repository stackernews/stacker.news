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

// on the server, generate HTML from the editor state in a fake DOM
// server-resolved HTML never reaches this branch on the server,
// the Reader dispatcher short-circuits it.
// on the client, prioritize resolved HTML so hydration adopts the server-painted div.
// fallback: if editor/genHTML errors, return html prop or ''
const initialContentEditable = (editor, html) => {
  try {
    if (typeof window === 'undefined') {
      return withDOM(() => generateHTML(editor))
    }
    return html || generateHTML(editor)
  } catch (e) {
    return html || ''
  }
}

// server-resolved HTML needs no editor: paint it directly.
// attributes must mirror HydratableContentEditable's output, hydration won't patch mismatches.
// data-lexical-editor is an exception, Lexical sets it at attach but CSS needs it at first paint
function ServerHTMLReader ({ html, innerClassName }) {
  return (
    <div
      aria-autocomplete='none'
      aria-readonly='true'
      className={innerClassName}
      contentEditable={false}
      role='textbox'
      spellCheck
      data-sn-reader='true'
      data-lexical-editor='true'
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function HydratableContentEditable ({ html, ...props }) {
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

function ComposedReader ({ topLevel, state, text, html, readerRef, innerClassName }) {
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
      $initialEditorState: (editor) => initiateEditorState(editor, state, text),
      onError: (error) => console.error('reader has encountered an error:', error)
    }), [topLevel, state, text])

  // paints resolved HTML or generates it, see initialContentEditable
  const contentEditable = useMemo(() => (
    <HydratableContentEditable html={html} data-sn-reader='true' className={innerClassName} />
  ), [html, innerClassName])

  return (
    <LexicalExtensionComposer extension={reader} contentEditable={contentEditable}>
      <EditorRefPlugin editorRef={readerRef} />
      <CodeThemePlugin />
      <NextLinkPlugin />
    </LexicalExtensionComposer>
  )
}

export default function Reader ({ topLevel, state, text, html, readerRef, innerClassName }) {
  // text is the supplied or truncated markdown,
  // it overrides html, so the server paints the same content the client builds from text
  const effectiveHTML = text ? undefined : html

  // instantly paint the server-resolved HTML
  if (typeof window === 'undefined' && effectiveHTML) {
    return <ServerHTMLReader html={effectiveHTML} innerClassName={innerClassName} />
  }

  return (
    <ComposedReader
      topLevel={topLevel}
      state={state}
      text={text}
      html={effectiveHTML}
      readerRef={readerRef}
      innerClassName={innerClassName}
    />
  )
}
