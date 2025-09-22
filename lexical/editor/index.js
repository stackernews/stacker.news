import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import styles from '@/lexical/theme/theme.module.css'
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
import { SN_TRANSFORMERS } from '@/lib/lexical/transformers/image-markdown-transformer'
import classNames from 'classnames'

export default function Editor ({ customNodes = [], context, placeholder, topLevel }) {
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
      ...theme,
      topLevel: topLevel || false // not the correct way to do this
    }
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
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
        <MarkdownShortcutPlugin transformers={SN_TRANSFORMERS} />
        <AutoLinkPlugin matchers={URL_MATCHERS} />
        <MentionsPlugin />
        <CustomAutoLinkPlugin />
        <CodeShikiPlugin />
        <HistoryPlugin />
        {/* triggers all the things that should happen when the editor state changes (writing, selecting, etc.) */}
        <OnChangePlugin context={context} />
      </div>
    </LexicalComposer>
  )
}
