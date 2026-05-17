import { useMemo } from 'react'
import { defineExtension, configExtension } from 'lexical'
import { RichTextExtension } from '@lexical/rich-text'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { ReactExtension } from '@lexical/react/ReactExtension'
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
import { withDOM } from '@/lib/lexical/server/dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'

/** creates a fake DOM to load Lexical in SSR */
const initialContentEditableSSR = (editor) => {
  if (typeof window !== 'undefined') return ''

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

function SSRContentEditable (props) {
  const [editor] = useLexicalComposerContext()

  return (
    <ContentEditable
      {...props}
      // client-side Lexical will replace the server HTML once it has mounted
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: initialContentEditableSSR(editor) }}
    />
  )
}

export default function Reader ({ topLevel, state, text, readerRef, innerClassName }) {
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
        MuteLexicalExtension,
        configExtension(ReactExtension, { contentEditable: null })
      ],
      theme: {
        ...theme,
        topLevel: topLevel && 'topLevel'
      },
      $initialEditorState: (editor) => initiateEditorState(editor, state, text),
      onError: (error) => console.error('reader has encountered an error:', error)
    }), [topLevel, state, text])

  return (
    <LexicalExtensionComposer
      extension={reader}
      contentEditable={<SSRContentEditable data-sn-reader='true' className={innerClassName} />}
    >
      <EditorRefPlugin editorRef={readerRef} />
      <CodeThemePlugin />
      <NextLinkPlugin />
    </LexicalExtensionComposer>
  )
}
