import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import styles from '@/components/lexical/theme/theme.module.css'
import theme from '../theme'
import ToolbarPlugin from '../plugins/toolbar'
import OnChangePlugin from '../plugins/onchange'
import { useFormikContext } from 'formik'
import DefaultNodes from '@/lib/lexical/nodes'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import MentionsPlugin from '../plugins/misc/mentions'
// import CustomAutoLinkPlugin from '../plugins/interop/autolink'
import CodeShikiPlugin from '../plugins/code/codeshiki'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import classNames from 'classnames'
import { SharedHistoryContextProvider, useSharedHistoryContext } from '@/components/lexical/contexts/sharedhistory'
import ModeStatusPlugin from '../plugins/mode/status'
import ModeSwitchPlugin from '../plugins/mode/switch'
import { ToolbarContextProvider } from '../contexts/toolbar'
import { useState, useMemo } from 'react'
// import LinkEditorPlugin from '../plugins/tools/linkeditor'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import ShortcutsPlugin from '../plugins/shortcuts'
import UniversalCommandsPlugin from '../universal/commands'
import FileUploadPlugin from '../plugins/tools/upload'
import { defineExtension } from 'lexical'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'

export default function Editor ({ ...props }) {
  const { values } = useFormikContext()

  const editorExtension = useMemo(() =>
    defineExtension({
      name: '[root]',
      namespace: 'SNEditor',
      $initialEditorState: (editor) => {
        if (values.lexicalState) {
          const state = editor.parseEditorState(values.lexicalState)
          editor.setEditorState(state)
        }
      },
      nodes: DefaultNodes,
      onError: (error) => {
        console.error(error)
      },
      theme
    }), [])

  return (
    <LexicalExtensionComposer extension={editorExtension} contentEditable={null}>
      <SharedHistoryContextProvider>
        <ToolbarContextProvider>
          <EditorContent {...props} />
        </ToolbarContextProvider>
      </SharedHistoryContextProvider>
    </LexicalExtensionComposer>
  )
}

function EditorContent ({ name, placeholder, autoFocus, maxLength, topLevel }) {
  // history can be shared between editors (e.g. this editor and the child image caption editor)
  const [floatingAnchorElem, setFloatingAnchorElem] = useState(null)
  const { historyState } = useSharedHistoryContext()

  const onRef = (_floatingAnchorElem) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem)
    }
  }

  return (
    <>
      {/* TODO: Toolbar context */}
      <div className={styles.editorContainer}>
        <ToolbarPlugin anchorElem={floatingAnchorElem} />
        <RichTextPlugin
          contentEditable={
            <div className={styles.editor} ref={onRef}>
              <ContentEditable
                className={classNames(styles.editorInput, styles.text, topLevel && styles.topLevel)}
                style={placeholder ? { '--placeholder': `"${placeholder}"` } : {}}
              />
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {/* shared history across editor and nested editors */}
        <HistoryPlugin externalHistoryState={historyState} />
        {autoFocus && <AutoFocusPlugin />}
        <ListPlugin />
        <CheckListPlugin />
        {/* link */}
        <LinkPlugin />
        {/* misc plugins */}
        <MentionsPlugin />
        {/* code */}
        <CodeShikiPlugin />
        {/* markdown */}
        <MarkdownShortcutPlugin transformers={SN_TRANSFORMERS} />
        {/* markdown <-> wysiwyg commands */}
        <UniversalCommandsPlugin />
        {/* markdown mode status and switch */}
        <ModeStatusPlugin />
        <ModeSwitchPlugin />
        {/* keyboard shortcuts */}
        <ShortcutsPlugin />
        {/* tools */}
        <FileUploadPlugin />
        {/* triggers all the things that should happen when the editor state changes (writing, selecting, etc.) */}
        <OnChangePlugin name={name} />
      </div>
    </>
  )
}
