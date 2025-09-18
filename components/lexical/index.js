import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import styles from './styles/theme.module.css'
import theme from './styles/theme'
import ToolbarPlugin from './plugins/toolbar'
import OnChangePlugin from './plugins/onchange'
import CodeShikiPlugin from './plugins/codeshiki'
import defaultNodes from '../../lib/lexical/nodes'
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin'
import MediaOrLinkPlugin, { URL_MATCHERS } from './plugins/interop/media-or-link'
import { useFormikContext } from 'formik'
import { SN_TRANSFORMERS } from '@/lib/lexical/transformers/image-markdown-transformer'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'

const onError = (error) => {
  console.error(error)
}

export function LexicalEditor ({ nodes = defaultNodes }, optionals = {}) {
  // temporary?
  const { values } = useFormikContext()

  const initial = {
    namespace: 'snEditor',
    theme,
    editorState: (editor) => {
      if (values.lexicalState) {
        // stored JSON has to be parsed as EditorState
        const state = editor.parseEditorState(values.lexicalState)
        editor.setEditorState(state)
      }
    },
    // TODO: re-instate this to force markdown mode at first
    // atm disabled to test the live preview
    //
    // editorState: () => {
    //   const root = $getRoot()
    //   if (root.getFirstChild() === null) {
    //     const codeBlock = $createCodeNode()
    //     codeBlock.setLanguage('markdown')
    //     root.append(codeBlock)
    //   }
    // },
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
        <MarkdownShortcutPlugin transformers={SN_TRANSFORMERS} />
        <AutoLinkPlugin matchers={URL_MATCHERS} />
        <MediaOrLinkPlugin />
        <CodeShikiPlugin />
        <HistoryPlugin />
        {/* triggers all the things that should happen when the editor state changes (writing, selecting, etc.) */}
        <OnChangePlugin {...optionals} />
      </LexicalComposer>
    </div>
  )
}
