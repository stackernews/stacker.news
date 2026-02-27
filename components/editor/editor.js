import classNames from 'classnames'
import { useField } from 'formik'
import { useMemo } from 'react'
import BootstrapForm from 'react-bootstrap/Form'
import { configExtension, defineExtension } from 'lexical'
import { ReactExtension } from '@lexical/react/ReactExtension'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { AutoFocusExtension } from '@lexical/extension'
import ShortcutsPlugin from '@/components/editor/plugins/core/shortcuts'
import { FormattingCommandsExtension } from '@/lib/lexical/exts/formatting'
import { ToolbarPlugin } from '@/components/editor/plugins/toolbar'
import FormikBridgePlugin from '@/components/editor/plugins/core/formik'
import LocalDraftPlugin from '@/components/editor/plugins/core/local-draft'
import { MaxLengthPlugin } from '@/components/editor/plugins/core/max-length'
import MentionsPlugin from '@/components/editor/plugins/mentions'
import FileUploadPlugin from '@/components/editor/plugins/upload'
import { $setMarkdown } from '@/lib/lexical/utils'
import theme from '@/lib/lexical/theme'
import styles from '@/lib/lexical/theme/editor.module.css'
import { HistoryExtension } from '@lexical/history'
import useCallbackRef from '../use-callback-ref'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { ApplePatchExtension } from '@/lib/lexical/exts/apple'
import { SoftkeyUnborkerPlugin } from '@/components/editor/plugins/patch/softkey-unborker'
import { SoftkeyEmptyGuardPlugin } from '@/components/editor/plugins/patch/softkey-emptyguard'
import { MarkdownTextExtension } from '@/lib/lexical/exts/markdown'
import AppendValuePlugin from '@/components/editor/plugins/core/append-value'
import TransformerBridgePlugin from '@/components/editor/plugins/core/transformer-bridge'
import { useEditorMode } from './contexts/mode'
import { $markdownToLexical } from '@/lib/lexical/utils/mdast'
import { RichTextExtension } from '@lexical/rich-text'
import DefaultNodes from '@/lib/lexical/nodes'
import { CheckListExtension, ListExtension } from '@lexical/list'
import { LinkExtension } from '@lexical/link'
import { AutoLinkExtension } from '@/lib/lexical/exts/autolink'
import { TableExtension } from '@lexical/table'
import { GalleryExtension } from '@/lib/lexical/exts/gallery'
import { CodeShikiSNExtension } from '@/lib/lexical/exts/shiki'
import { CodeThemePlugin } from './plugins/core/code-theme'
import LinkEditorPlugin from './plugins/link'
import { DecoratorClickZonesExtension } from '@/lib/lexical/exts/decorator-click-zones'

const EDITOR_MARKDOWN_MODE = {
  name: 'editor-markdown',
  namespace: 'sn-markdown',
  dependencies: [MarkdownTextExtension],
  nodes: []
}

const EDITOR_RICH_MODE = {
  name: 'editor-rich',
  namespace: 'sn-rich', // namespace is used for copy/paste between identical editors
  dependencies: [
    RichTextExtension,
    CodeShikiSNExtension,
    ListExtension,
    CheckListExtension,
    LinkExtension,
    TableExtension,
    GalleryExtension,
    AutoLinkExtension,
    DecoratorClickZonesExtension
  ],
  nodes: DefaultNodes
}

/**
 * main lexical editor component with formik integration
 * @param {string} props.name - form field name
 * @param {string} [props.appendValue] - value to append to initial content
 * @param {boolean} [props.autoFocus] - whether to auto-focus the editor
 * @returns {JSX.Element} lexical editor component
 */
export default function Editor ({ name, autoFocus, topLevel, ...props }) {
  const { isMarkdown } = useEditorMode()
  const [text] = useField({ name })

  const modeConfig = useMemo(() => (isMarkdown ? EDITOR_MARKDOWN_MODE : EDITOR_RICH_MODE), [isMarkdown])

  const editor = useMemo(() =>
    defineExtension({
      $initialEditorState: () => {
        // initialize editor state with existing formik text
        if (text.value) {
          if (isMarkdown) {
            $setMarkdown(text.value, true)
          } else {
            $markdownToLexical(text.value)
          }
        }
      },
      name: modeConfig.name,
      namespace: modeConfig.namespace,
      dependencies: [
        ApplePatchExtension,
        HistoryExtension,
        FormattingCommandsExtension,
        configExtension(ReactExtension, { contentEditable: null }),
        configExtension(AutoFocusExtension, { disabled: !autoFocus }),
        ...modeConfig.dependencies
      ],
      nodes: modeConfig.nodes,
      theme: { ...theme, topLevel: topLevel ? 'topLevel' : '' },
      onError: (error) => console.error('editor has encountered an error:', error)
    // only depend on stable values to avoid unnecessary re-renders
    // text.value is, for example, not stable because it is updated by the formik context
    }), [autoFocus, topLevel, modeConfig])

  return (
    <LexicalExtensionComposer key={modeConfig.name} extension={editor} contentEditable={null}>
      <EditorContent topLevel={topLevel} isMarkdown={isMarkdown} name={name} {...props} />
    </LexicalExtensionComposer>
  )
}

/**
 * editor content component containing all plugins and UI elements
 * @param {string} props.name - form field name for draft saving
 * @param {string} props.placeholder - placeholder text for empty editor
 * @param {Object} props.lengthOptions - max length configuration
 * @param {boolean} props.topLevel - whether this is a top-level editor
 * @param {boolean} props.isMarkdown - whether the editor is in markdown mode
 * @param {boolean} [props.required] - whether the field is required
 * @param {number} [props.minRows] - minimum number of rows for the editor
 * @param {React.ReactNode} [props.label] - label for the editor
 * @param {React.ReactNode} [props.hint] - hint text for the editor
 * @param {React.ReactNode} [props.warn] - warning text for the editor
 * @returns {JSX.Element} editor content with all plugins
 */
function EditorContent ({
  name, placeholder, lengthOptions,
  topLevel, isMarkdown, required = false,
  minRows, hint, warn, editorRef, appendValue
}) {
  const { ref: containerRef, onRef: onContainerRef } = useCallbackRef()

  return (
    <div className={classNames(styles.editorContainer)} data-top-level={topLevel ? 'true' : 'false'}>
      <EditorRefPlugin editorRef={editorRef} />
      <ToolbarPlugin topLevel={topLevel} name={name} />
      {/* we only need a plain text editor for markdown */}
      <div
        className={classNames(styles.editor, !isMarkdown && 'sn-text')}
        data-lexical-mode={isMarkdown ? 'markdown' : 'rich'}
        ref={onContainerRef}
      >
        <ContentEditable
          translate='no'
          data-sn-editor='true'
          className={classNames(styles.editorContent, styles.editorContentInput, isMarkdown && 'sn-text')}
          /* lh is a css unit that is equal to the line height of the element
              probably the worst thing is that we have to add 1 to the minRows to get the correct height
          */
          style={{ minHeight: `${(minRows ?? 0) + 1}lh` }}
          placeholder={<div className={styles.editorPlaceholder}>{placeholder}</div>}
          aria-required={required}
        />
      </div>
      <FileUploadPlugin editorRef={containerRef} />
      <MentionsPlugin />
      <ShortcutsPlugin />
      <AppendValuePlugin value={appendValue} />
      <LocalDraftPlugin name={name} />
      <FormikBridgePlugin name={name} />
      <MaxLengthPlugin lengthOptions={lengthOptions} />
      <SoftkeyUnborkerPlugin />
      <SoftkeyEmptyGuardPlugin />
      {!isMarkdown && (
        <>
          <CodeThemePlugin />
          <LinkEditorPlugin anchorElem={containerRef} />
        </>
      )}
      {isMarkdown && <TransformerBridgePlugin />}
      {hint && <BootstrapForm.Text>{hint}</BootstrapForm.Text>}
      {warn && <BootstrapForm.Text className='text-warning'>{warn}</BootstrapForm.Text>}
    </div>
  )
}
