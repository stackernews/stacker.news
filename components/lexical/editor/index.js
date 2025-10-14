import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import styles from '@/components/lexical/theme/theme.module.css'
import theme from '../theme'
import ToolbarPlugin from '../plugins/toolbar'
import FormikBridgePlugin from '../plugins/formik'
import { useFormikContext } from 'formik'
import DefaultNodes from '@/lib/lexical/nodes'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import MentionsPlugin from '../plugins/misc/mentions'
import CodeShikiPlugin from '../plugins/code'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import classNames from 'classnames'
import { useSharedHistoryContext } from '@/components/lexical/contexts/sharedhistory'
import ModeSwitchPlugin from '../plugins/mode/switch'
import { useState, useMemo } from 'react'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import ShortcutsPlugin from '../plugins/shortcuts'
import UniversalCommandsPlugin from '../universal/commands'
import FileUploadPlugin from '../plugins/misc/upload'
import { defineExtension } from 'lexical'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'
import { LexicalEditorProviders } from '@/components/lexical/providers'
import FloatingToolbarPlugin from '../plugins/toolbar/floating/floatingtoolbar'

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
        // TODO: good error handling
        console.error(error)
      },
      theme
    }), [])

  return (
    <LexicalExtensionComposer extension={editorExtension} contentEditable={null}>
      <LexicalEditorProviders>
        <EditorContent {...props} />
      </LexicalEditorProviders>
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
        <div className={styles.editorInnerContainer}>
          <RichTextPlugin
            contentEditable={
              <div className={styles.editor} ref={onRef}>
                <ContentEditable
                  className={classNames(styles.editorInput, styles.text, topLevel && styles.topLevel)}
                  placeholder={<div className={styles.editorPlaceholder}>{placeholder}</div>}
                />
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        {/* shared history across editor and nested editors */}
        <HistoryPlugin externalHistoryState={historyState} />
        {autoFocus && <AutoFocusPlugin />}
        <ListPlugin />
        <CheckListPlugin />
        <TablePlugin />
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
        <ModeSwitchPlugin />
        {/* keyboard shortcuts */}
        <ShortcutsPlugin />
        {/* tools */}
        <FileUploadPlugin />
        <FloatingToolbarPlugin anchorElem={floatingAnchorElem} />
        {/* triggers all the things that should happen when the editor state changes (writing, selecting, etc.) */}
        <FormikBridgePlugin name={name} />
      </div>
    </>
  )
}
