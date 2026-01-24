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
import { MDCommandsExtension } from '@/lib/lexical/exts/md-commands'
import { useToolbarState } from '@/components/editor/contexts/toolbar'
import { ToolbarPlugin } from '@/components/editor/plugins/toolbar'
import FormikBridgePlugin from '@/components/editor/plugins/core/formik'
import LocalDraftPlugin from '@/components/editor/plugins/core/local-draft'
import { MaxLengthPlugin } from '@/components/editor/plugins/core/max-length'
import MentionsPlugin from '@/components/editor/plugins/mentions'
import FileUploadPlugin from '@/components/editor/plugins/upload'
import PreviewPlugin from '@/components/editor/plugins/preview'
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
import { RichTextExtension } from '@lexical/rich-text'
import { markdownToLexical } from '@/lib/lexical/utils/mdast'
import DefaultNodes from '@/lib/lexical/nodes'
/**
 * main lexical editor component with formik integration
 * @param {string} props.name - form field name
 * @param {string} [props.appendValue] - value to append to initial content
 * @param {boolean} [props.autoFocus] - whether to auto-focus the editor
 * @returns {JSX.Element} lexical editor component
 */
export default function Editor ({ name, autoFocus, topLevel, ...props }) {
  const { toolbarState } = useToolbarState()
  const [text] = useField({ name })

  console.log('toolbarState', toolbarState)

  const editor = useMemo(() =>
    defineExtension({
      $initialEditorState: (editor) => {
        console.log('initializing editor state')
        // initialize editor state with existing formik text
        if (text.value) {
          if (toolbarState.editorMode === 'markdown') {
            $setMarkdown(text.value)
          } else {
            markdownToLexical(editor, text.value)
          }
        }
      },
      name: 'editor',
      namespace: 'sn',
      dependencies: [
        toolbarState.editorMode === 'markdown' ? MarkdownTextExtension : RichTextExtension,
        ApplePatchExtension,
        HistoryExtension,
        ...(toolbarState.editorMode === 'markdown' ? [MDCommandsExtension] : []),
        configExtension(ReactExtension, { contentEditable: null }),
        configExtension(AutoFocusExtension, { disabled: !autoFocus })
      ],
      nodes: toolbarState.editorMode === 'rich' ? DefaultNodes : [],
      theme: { ...theme, topLevel: topLevel ? 'topLevel' : '' },
      onError: (error) => console.error('editor has encountered an error:', error)
    // only depend on stable values to avoid unnecessary re-renders
    // text.value is, for example, not stable because it is updated by the formik context
    }), [autoFocus, topLevel, toolbarState.editorMode])

  return (
    <LexicalExtensionComposer key={toolbarState.editorMode} extension={editor} contentEditable={null}>
      <EditorContent topLevel={topLevel} editorMode={toolbarState.editorMode} name={name} {...props} />
    </LexicalExtensionComposer>
  )
}

/**
 * editor content component containing all plugins and UI elements
 * @param {string} props.name - form field name for draft saving
 * @param {string} props.placeholder - placeholder text for empty editor
 * @param {Object} props.lengthOptions - max length configuration
 * @param {boolean} props.topLevel - whether this is a top-level editor
 * @param {boolean} [props.required] - whether the field is required
 * @param {number} [props.minRows] - minimum number of rows for the editor
 * @param {React.ReactNode} [props.label] - label for the editor
 * @param {React.ReactNode} [props.hint] - hint text for the editor
 * @param {React.ReactNode} [props.warn] - warning text for the editor
 * @returns {JSX.Element} editor content with all plugins
 */
function EditorContent ({ name, placeholder, lengthOptions, topLevel, editorMode, required = false, minRows, hint, warn, editorRef, appendValue }) {
  const { ref: containerRef, onRef: onContainerRef } = useCallbackRef()

  return (
    <div className={classNames(styles.editorContainer)} data-top-level={topLevel ? 'true' : 'false'}>
      <EditorRefPlugin editorRef={editorRef} />
      <ToolbarPlugin topLevel={topLevel} name={name} />
      {/* we only need a plain text editor for markdown */}
      <div className={classNames(styles.editor, editorMode === 'rich' && 'sn-text')} ref={onContainerRef}>
        <ContentEditable
          translate='no'
          data-sn-editor='true'
          className={classNames(styles.editorContent, styles.editorContentInput, 'sn-text')}
          /* lh is a css unit that is equal to the line height of the element
              probably the worst thing is that we have to add 1 to the minRows to get the correct height
          */
          style={{ minHeight: `${(minRows ?? 0) + 1}lh` }}
          placeholder={<div className={styles.editorPlaceholder}>{placeholder}</div>}
          aria-required={required}
        />
      </div>
      {containerRef && (
        <PreviewPlugin
          editorRef={containerRef}
          topLevel={topLevel}
          name={name}
        />
      )}
      <FileUploadPlugin editorRef={containerRef} />
      <MentionsPlugin />
      <ShortcutsPlugin />
      <AppendValuePlugin value={appendValue} />
      <LocalDraftPlugin name={name} editorMode={editorMode} />
      <FormikBridgePlugin name={name} />
      <MaxLengthPlugin lengthOptions={lengthOptions} />
      <SoftkeyUnborkerPlugin />
      <SoftkeyEmptyGuardPlugin />
      {hint && <BootstrapForm.Text>{hint}</BootstrapForm.Text>}
      {warn && <BootstrapForm.Text className='text-warning'>{warn}</BootstrapForm.Text>}
    </div>
  )
}
