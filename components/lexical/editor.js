import { useFormikContext } from 'formik'
import { configExtension, defineExtension } from 'lexical'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { useMemo, useState } from 'react'
import classNames from 'classnames'
import { useLexicalPreferences } from './contexts/preferences'
import { useSharedHistoryContext, SharedHistoryContextProvider } from './contexts/sharedhistory'
import { TableContextProvider } from './contexts/table'
import { ToolbarContextProvider } from './contexts/toolbar'
import { CodeShikiSNExtension } from '../../lib/lexical/extensions/core/code'
import { CodeThemePlugin } from './plugins/core/code-theme'
import FileUploadPlugin from './plugins/inserts/upload'
import FloatingToolbarPlugin from './plugins/toolbar/floating/floatingtoolbar'
import LinkEditorPlugin from './plugins/inserts/link'
import MentionsPlugin from './plugins/decorative/mention'
import ModeSwitcher from './plugins/core/mode/switch'
import { ShortcutsExtension } from '../../lib/lexical/extensions/core/shortcuts'
import { ToolbarPlugin } from './plugins/toolbar'
import { SNCommandsExtension } from '../../lib/lexical/extensions/core/commands'
import { $initializeEditorState } from '../../lib/lexical/universal/utils'
import DefaultNodes from '@/lib/lexical/nodes'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import styles from './theme/theme.module.css'
import theme from './theme'
import { MaxLengthPlugin } from './plugins/misc/max-length'
import TransformerBridgePlugin from './plugins/core/transformer-bridge'
import { MarkdownModeExtension } from '../../lib/lexical/extensions/core/mode'
import { MediaCheckExtension } from './plugins/misc/media-check'
import LocalDraftPlugin from './plugins/core/local-draft'
import FormikBridgePlugin from './plugins/core/formik'
import { CheckListExtension, ListExtension } from '@lexical/list'
import { LinkExtension } from '@lexical/link'
import { TableExtension } from '@lexical/table'
import { AutoFocusExtension, HorizontalRuleExtension } from '@lexical/extension'
import { SNAutoLinkExtension } from '../../lib/lexical/extensions/decorative/autolink'
import PreferencesPlugin from './plugins/core/preferences'
import MediaDragDropPlugin from './plugins/content/media/dnd'
import TableActionMenuPlugin from './plugins/inserts/table/action'
// import DraggableBlockPlugin from './plugins/core/draggable-block'
import { TableOfContentsExtension } from '@/lib/lexical/extensions/toc'

export default function Editor ({ name, appendValue, autoFocus, ...props }) {
  const { prefs } = useLexicalPreferences()
  const { values } = useFormikContext()

  const editor = useMemo(() =>
    defineExtension({
      $initialEditorState: (editor) => {
        if (appendValue) {
          return $initializeEditorState(prefs.startInMarkdown, editor, appendValue)
        }
        // if initial state, parse it
        if (values.lexicalState) {
          try {
            const state = editor.parseEditorState(values.lexicalState)
            if (!state.isEmpty()) {
              editor.setEditorState(state)
            // if the parsed state is empty and start in markdown, initialize markdown
            } else if (prefs.startInMarkdown) {
              return $initializeEditorState(true)
            }
          } catch (error) {
            console.error('cannot load initial state:', error)
          }
        // if no initial state and start in markdown, initialize markdown
        } else if (prefs.startInMarkdown) {
          return $initializeEditorState(true)
        } else {
          return $initializeEditorState(false)
        }
      },
      name: 'editor',
      namespace: 'SN',
      nodes: DefaultNodes,
      dependencies: [
        SNAutoLinkExtension,
        CodeShikiSNExtension,
        MarkdownModeExtension,
        MediaCheckExtension,
        ShortcutsExtension,
        ListExtension,
        CheckListExtension,
        LinkExtension,
        TableExtension,
        SNCommandsExtension,
        HorizontalRuleExtension,
        TableOfContentsExtension,
        configExtension(AutoFocusExtension, { disabled: !autoFocus })
      ],
      theme,
      onError: (error) => console.error('stacker news editor has encountered an error:', error)
    }), [autoFocus])

  return (
    <LexicalExtensionComposer extension={editor} contentEditable={null}>
      <SharedHistoryContextProvider>
        <ToolbarContextProvider>
          <TableContextProvider>
            <EditorContent {...props} />
          </TableContextProvider>
        </ToolbarContextProvider>
      </SharedHistoryContextProvider>
    </LexicalExtensionComposer>
  )
}

function EditorContent ({ name, placeholder, lengthOptions, topLevel }) {
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
        <div style={{ position: 'relative' }}>
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
        {/* inserts */}
        <FileUploadPlugin />
        {/* inserts: links */}
        <LinkEditorPlugin anchorElem={floatingAnchorElem} />
        {/* inserts: table action menu */}
        <TableActionMenuPlugin anchorElem={floatingAnchorElem} cellMerge />
        {/* decorative plugins */}
        <MentionsPlugin />
        {/* code */}
        <CodeThemePlugin />
        {/* markdown */}
        <MarkdownShortcutPlugin transformers={SN_TRANSFORMERS} />
        {/* markdown mode status and switch */}
        <div className={styles.bottomBar}>
          <ModeSwitcher />
          <PreferencesPlugin />
        </div>
        <MaxLengthPlugin lengthOptions={lengthOptions} />
        {/* floating toolbar */}
        <FloatingToolbarPlugin anchorElem={floatingAnchorElem} />
        {/* media insert & DnD */}
        <MediaDragDropPlugin />
        {/* draggable block */}
        {/* <DraggableBlockPlugin anchorElem={floatingAnchorElem} /> */}
        {/* formik */}
        <LocalDraftPlugin name={name} />
        <FormikBridgePlugin />
      </div>
    </>
  )
}
