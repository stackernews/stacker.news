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
import { useLexicalPreferences } from '@/components/lexical/contexts/preferences'
import { useSharedHistoryContext, SharedHistoryContextProvider } from '@/components/lexical/contexts/sharedhistory'
import { TableContextProvider } from '@/components/lexical/contexts/table'
import { ToolbarContextProvider } from '@/components/lexical/contexts/toolbar'
import { CodeShikiSNExtension } from '@/lib/lexical/extensions/core/code'
import { CodeThemePlugin } from '@/components/lexical/plugins/core/code-theme'
import FileUploadPlugin from '@/components/lexical/plugins/inserts/upload'
import FloatingToolbarPlugin from '@/components/lexical/plugins/toolbar/floating/floatingtoolbar'
import LinkEditorPlugin from '@/components/lexical/plugins/inserts/link'
import MentionsPlugin from '@/components/lexical/plugins/decorative/mention'
import ModeSwitcherPlugin from '@/components/lexical/plugins/core/mode/switch'
import { ShortcutsExtension } from '@/lib/lexical/extensions/core/shortcuts'
import { ToolbarPlugin } from '@/components/lexical/plugins/toolbar'
import { SNCommandsExtension } from '@/lib/lexical/extensions/core/commands'
import { $initializeEditorState } from '@/lib/lexical/universal/utils'
import DefaultNodes from '@/lib/lexical/nodes'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import styles from './theme/theme.module.css'
import theme from './theme'
import { MaxLengthPlugin } from '@/components/lexical/plugins/misc/max-length'
import TransformerBridgePlugin from '@/components/lexical/plugins/core/transformer-bridge'
import { MarkdownModeExtension } from '@/lib/lexical/extensions/core/mode'
import { MediaCheckExtension } from '@/components/lexical/plugins/misc/media-check'
import LocalDraftPlugin from '@/components/lexical/plugins/core/local-draft'
import FormikBridgePlugin from '@/components/lexical/plugins/core/formik'
import { CheckListExtension, ListExtension } from '@lexical/list'
import { LinkExtension } from '@lexical/link'
import { TableExtension } from '@lexical/table'
import { AutoFocusExtension, HorizontalRuleExtension } from '@lexical/extension'
import { SNAutoLinkExtension } from '@/lib/lexical/extensions/decorative/autolink'
import PreferencesPlugin from '@/components/lexical/plugins/core/preferences'
import TableActionMenuPlugin from '@/components/lexical/plugins/inserts/table/action'
import { TableOfContentsExtension } from '@/lib/lexical/extensions/toc'
import { SpoilerExtension } from '@/lib/lexical/extensions/formatting/spoiler'
import CodeActionsPlugin from './plugins/decorative/code-actions'
import { MediaDragDropExtension } from '@/lib/lexical/extensions/content/media-dnd'

/**
 * main lexical editor component with formik integration
 * @param {string} props.name - form field name
 * @param {string} [props.appendValue] - value to append to initial content
 * @param {boolean} [props.autoFocus] - whether to auto-focus the editor
 * @returns {JSX.Element} lexical editor component
 */
export default function Editor ({ name, appendValue, autoFocus, topLevel, ...props }) {
  const { prefs } = useLexicalPreferences()
  const { values } = useFormikContext()

  const editor = useMemo(() =>
    defineExtension({
      $initialEditorState: (editor) => {
        // append value takes precedence
        if (appendValue) {
          return $initializeEditorState(prefs.startInMarkdown, editor, appendValue)
        }
        // territory descriptions are always markdown
        if (values.desc) {
          return $initializeEditorState(true, editor, values.desc)
        }
        // existing lexical state
        if (values.lexicalState) {
          try {
            const state = editor.parseEditorState(values.lexicalState)
            if (!state.isEmpty()) {
              editor.setEditorState(state)
              return
            }
          } catch (error) {
            console.error('failed to load initial state:', error)
          }
        }

        // default: initialize based on user preference
        return $initializeEditorState(prefs.startInMarkdown)
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
        SpoilerExtension,
        MediaDragDropExtension,
        configExtension(AutoFocusExtension, { disabled: !autoFocus })
      ],
      theme: { ...theme, topLevel: topLevel ? 'topLevel' : '' },
      onError: (error) => console.error('stacker news editor has encountered an error:', error)
    }), [autoFocus, topLevel])

  return (
    <LexicalExtensionComposer extension={editor} contentEditable={null}>
      <SharedHistoryContextProvider>
        <ToolbarContextProvider>
          <TableContextProvider>
            <EditorContent topLevel={topLevel} {...props} />
          </TableContextProvider>
        </ToolbarContextProvider>
      </SharedHistoryContextProvider>
    </LexicalExtensionComposer>
  )
}

/**
 * editor content component containing all plugins and UI elements
 * @param {string} props.name - form field name for draft saving
 * @param {string} props.placeholder - placeholder text for empty editor
 * @param {Object} props.lengthOptions - max length configuration
 * @param {boolean} props.topLevel - whether this is a top-level editor
 * @returns {JSX.Element} editor content with all plugins
 */
function EditorContent ({ name, placeholder, lengthOptions, topLevel }) {
  const [floatingAnchorElem, setFloatingAnchorElem] = useState(null)
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
                  className={classNames(styles.editorInput, styles.text, topLevel && 'topLevel')}
                  placeholder={<div className={styles.editorPlaceholder}>{placeholder}</div>}
                />
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin externalHistoryState={historyState} />
        <FileUploadPlugin anchorElem={floatingAnchorElem} />
        <LinkEditorPlugin anchorElem={floatingAnchorElem} />
        <TableActionMenuPlugin anchorElem={floatingAnchorElem} cellMerge />
        <MentionsPlugin />
        <CodeThemePlugin />
        <CodeActionsPlugin anchorElem={floatingAnchorElem} />
        <MarkdownShortcutPlugin transformers={SN_TRANSFORMERS} />
        <div className={styles.bottomBar}>
          <ModeSwitcherPlugin />
          <span className={styles.bottomBarDivider}> \ </span>
          <PreferencesPlugin />
        </div>
        <MaxLengthPlugin lengthOptions={lengthOptions} />
        <FloatingToolbarPlugin anchorElem={floatingAnchorElem} />
        <LocalDraftPlugin name={name} />
        <FormikBridgePlugin />
      </div>
    </>
  )
}
