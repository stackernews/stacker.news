import { useFormikContext } from 'formik'
import { defineExtension } from 'lexical'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'
import { useMemo, useState } from 'react'
import classNames from 'classnames'
import CodeShikiPlugin from '../plugins/code'
import FileUploadPlugin from '../plugins/misc/upload'
import FloatingToolbarPlugin from '../plugins/toolbar/floating/floatingtoolbar'
import FormikBridgePlugin from '../plugins/formik'
import LinkTransformationPlugin from '../plugins/links/transformator'
import MentionsPlugin from '../plugins/misc/mentions'
import ModeSwitchPlugin from '../plugins/mode/switch'
import PreferencesPlugin from '../plugins/preferences'
import ShortcutsPlugin from '../plugins/shortcuts'
import ToolbarPlugin from '../plugins/toolbar'
import UniversalCommandsPlugin from '../universal/commands'
import { $initializeMarkdown } from '../universal/utils'
import { useLexicalPreferences, LexicalPreferencesContextProvider } from '../contexts/preferences'
import DefaultNodes from '@/lib/lexical/nodes'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { useSharedHistoryContext, SharedHistoryContextProvider } from '@/components/lexical/contexts/sharedhistory'
import { TableContextProvider } from '@/components/lexical/contexts/table'
import { ToolbarContextProvider } from '@/components/lexical/contexts/toolbar'
import styles from '@/components/lexical/theme/theme.module.css'
import theme from '../theme'

export default function Editor ({ ...props }) {
  const { prefs } = useLexicalPreferences()
  const { values } = useFormikContext()

  const editorExtension = useMemo(() =>
    defineExtension({
      name: '[root]',
      namespace: 'SNEditor',
      $initialEditorState: (editor) => {
        // if initial state, parse it
        if (values.lexicalState) {
          try {
            const state = editor.parseEditorState(values.lexicalState)
            if (!state.isEmpty()) {
              editor.setEditorState(state)
            // if the parsed state is empty and start in markdown, initialize markdown
            } else if (prefs.startInMarkdown) {
              return editor.update(() => $initializeMarkdown())
            }
          } catch (error) {
            console.error('cannot load initial state:', error)
          }
        // if no initial state and start in markdown, initialize markdown
        } else if (prefs.startInMarkdown) {
          return editor.update(() => $initializeMarkdown())
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
    <LexicalPreferencesContextProvider>
      <LexicalExtensionComposer extension={editorExtension} contentEditable={null}>
        <SharedHistoryContextProvider>
          <ToolbarContextProvider>
            <TableContextProvider>
              <EditorContent {...props} />
            </TableContextProvider>
          </ToolbarContextProvider>
        </SharedHistoryContextProvider>
      </LexicalExtensionComposer>
    </LexicalPreferencesContextProvider>
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
        <ToolbarPlugin anchorElem={floatingAnchorElem} topLevel={topLevel} />
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
        <LinkTransformationPlugin anchorElem={floatingAnchorElem} />
        {/* misc plugins */}
        <MentionsPlugin />
        {/* code */}
        <CodeShikiPlugin />
        {/* markdown */}
        <MarkdownShortcutPlugin transformers={SN_TRANSFORMERS} />
        {/* markdown <-> wysiwyg commands */}
        <UniversalCommandsPlugin />
        {/* markdown mode status and switch */}
        <div className={styles.bottomBar}>
          <ModeSwitchPlugin />
          <PreferencesPlugin />
        </div>
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
