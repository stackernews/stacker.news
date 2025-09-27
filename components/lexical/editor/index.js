import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import styles from '@/components/lexical/theme/theme.module.css'
import theme from '../theme'
import ToolbarPlugin from '../plugins/toolbar'
import OnChangePlugin from '../plugins/onchange'
import { useFormikContext } from 'formik'
import DefaultNodes from '@/lib/lexical/nodes'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin'
import MentionsPlugin from '../plugins/interop/mentions'
import CustomAutoLinkPlugin, { URL_MATCHERS } from '../plugins/interop/autolink'
import CodeShikiPlugin from '../plugins/codeshiki'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import classNames from 'classnames'
import AutofocusPlugin from '../plugins/autofocus'
import { SharedHistoryContextProvider, useSharedHistoryContext } from '@/components/lexical/contexts/sharedhistorycontext'
import ModePlugin from '../plugins/mode'

export default function Editor ({ customNodes = [], ...props }) {
  const { values } = useFormikContext()

  const initialConfig = {
    editorState: (editor) => {
      if (values.lexicalState) {
        const state = editor.parseEditorState(values.lexicalState)
        editor.setEditorState(state)
      }
    },
    namespace: 'SNEditor',
    nodes: [...DefaultNodes, ...customNodes],
    onError: (error) => {
      console.error(error)
    },
    theme: {
      ...theme
    }
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <SharedHistoryContextProvider>
        <EditorContent {...props} />
      </SharedHistoryContextProvider>
    </LexicalComposer>
  )
}

function EditorContent ({ name, placeholder, autoFocus, maxLength, topLevel }) {
  const { historyState } = useSharedHistoryContext()

  return (
    <>
      {/* TODO: Toolbar context */}
      <div className={styles.editorContainer}>
        <ToolbarPlugin />
        <RichTextPlugin
          contentEditable={
            <div className={styles.editor}>
              <ContentEditable
                className={classNames(styles.editorInput, styles.text, topLevel && styles.topLevel)}
                style={placeholder ? { '--placeholder': `"${placeholder}"` } : {}}
              />
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {autoFocus && <AutofocusPlugin />}
        <MarkdownShortcutPlugin transformers={SN_TRANSFORMERS} />
        <MentionsPlugin />
        <CustomAutoLinkPlugin />
        <CodeShikiPlugin />
        <HistoryPlugin externalHistoryState={historyState} />
        {/* triggers all the things that should happen when the editor state changes (writing, selecting, etc.) */}
        <OnChangePlugin name={name} />
        <ModePlugin />
      </div>
    </>
  )
}
