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

/** creates a fake DOM to load Lexical in SSR */
const renderServerHTML = (editor) => {
  return withDOM(() => {
    // attach a temporary root element to the editor
    // and let lexical render its content into it
    const root = document.createElement('div')
    editor.setRootElement(root)
    const { innerHTML } = root
    editor.setRootElement(null)
    // return the rendered content as HTML
    return innerHTML
  })
}

/**
 * initial innerHTML for contentEditable
 * - server: paint the server-resolved html if available, otherwise
 *           generate a fake DOM to prepare Lexical for SSR content generation
 * - client: paint the resolver html on fresh mounts; either way Lexical repaints
 *           the root element from the editor state as soon as ContentEditable attaches it
 */
const initialContentEditable = (editor, html) => {
  if (typeof window === 'undefined') {
    return html ?? renderServerHTML(editor)
  }
  return html ?? ''
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
  // text (e.g. truncated markdown) overrides html, so the server paints
  // the same content the client builds from text
  const effectiveHTML = text ? undefined : html

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
      // the server paints the resolver html directly, so it only builds the editor state
      // for the renderServerHTML fallback (non-items lacking html, or text overriding it);
      // the client always builds it, so anything it paints comes from the editor state
      $initialEditorState: (editor) => {
        if (typeof window === 'undefined' && effectiveHTML) return
        initiateEditorState(editor, state, text)
      },
      onError: (error) => console.error('reader has encountered an error:', error)
    }), [topLevel, state, text, effectiveHTML])

  const contentEditable = useMemo(() => (
    <SSRContentEditable html={effectiveHTML} data-sn-reader='true' className={innerClassName} />
  ), [effectiveHTML, innerClassName])

  return (
    <LexicalExtensionComposer extension={reader} contentEditable={contentEditable}>
      <EditorRefPlugin editorRef={readerRef} />
      <CodeThemePlugin />
      <NextLinkPlugin />
    </LexicalExtensionComposer>
  )
}
