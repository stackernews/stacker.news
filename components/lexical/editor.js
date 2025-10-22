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
import { useLexicalPreferences, LexicalPreferencesContextProvider } from './contexts/preferences'
import { useSharedHistoryContext, SharedHistoryContextProvider } from './contexts/sharedhistory'
import { TableContextProvider } from './contexts/table'
import { ToolbarContextProvider } from './contexts/toolbar'
import { CodeShikiSNExtension, CodeThemePlugin } from './plugins/core/code'
import FileUploadPlugin from './plugins/inserts/upload'
import FloatingToolbarPlugin from './plugins/toolbar/floating/floatingtoolbar'
import FormikPlugin from './plugins/core/formik'
import LinkTransformationPlugin from './plugins/inserts/links/transformator'
import MentionsPlugin from './plugins/decorative/mentions'
import ModeSwitchPlugin from './plugins/core/mode/switch'
import PreferencesPlugin from './plugins/core/preferences'
import ShortcutsPlugin from './plugins/core/shortcuts'
import ToolbarPlugin from './plugins/toolbar'
import UniversalCommandsPlugin from './universal/commands'
import { $initializeMarkdown } from './universal/utils'
import DefaultNodes from '@/lib/lexical/nodes'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import styles from './theme/theme.module.css'
import theme from './theme'
import { MaxLengthPlugin } from './plugins/misc/max-length'
import TransformerBridgePlugin from './plugins/core/transformerbridge'

export default function Editor ({ ...props }) {
  const { prefs } = useLexicalPreferences()
  const { values } = useFormikContext()

  const editor = useMemo(() =>
    defineExtension({
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
      name: 'editor',
      namespace: 'SN',
      nodes: DefaultNodes,
      dependencies: [CodeShikiSNExtension],
      theme
    }), [])

  return (
    <LexicalPreferencesContextProvider>
      <LexicalExtensionComposer extension={editor} contentEditable={null}>
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
  const [floatingAnchorElem, setFloatingAnchorElem] = useState(null)
  // history can be shared between editors (e.g. this editor and the child image caption editor)
  const { historyState } = useSharedHistoryContext()

  const onRef = (_floatingAnchorElem) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem)
    }
  }

  return (
    <>
      <div className={styles.editorContainer}>
        <TransformerBridgePlugin nodes={DefaultNodes} />
        <ToolbarPlugin topLevel={topLevel} />
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
        {/* inserts */}
        <ListPlugin />
        <CheckListPlugin />
        <TablePlugin />
        <FileUploadPlugin />
        {/* inserts: links */}
        <LinkPlugin />
        <LinkTransformationPlugin anchorElem={floatingAnchorElem} />
        {/* decorative plugins */}
        <MentionsPlugin />
        {/* code */}
        <CodeThemePlugin />
        {/* markdown */}
        <MarkdownShortcutPlugin transformers={SN_TRANSFORMERS} />
        {/* markdown <-> wysiwyg commands */}
        <UniversalCommandsPlugin />
        {/* markdown mode status and switch */}
        <div className={styles.bottomBar}>
          <ModeSwitchPlugin />
          <PreferencesPlugin />
        </div>
        {maxLength && <MaxLengthPlugin maxLength={maxLength} />}
        {/* keyboard shortcuts */}
        <ShortcutsPlugin />
        {/* floating toolbar */}
        <FloatingToolbarPlugin anchorElem={floatingAnchorElem} />
        {/* formik */}
        <FormikPlugin name={name} />
      </div>
    </>
  )
}
