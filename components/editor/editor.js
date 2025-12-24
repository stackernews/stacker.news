import classNames from 'classnames'
import { useField } from 'formik'
import { useMemo } from 'react'
import BootstrapForm from 'react-bootstrap/Form'
import { configExtension, defineExtension } from 'lexical'
import { PlainTextExtension } from '@lexical/plain-text'
import { ReactExtension } from '@lexical/react/ReactExtension'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { AutoFocusExtension } from '@lexical/extension'
import { ShortcutsExtension } from '@/lib/lexical/exts/shortcuts'
import { MDCommandsExtension } from '@/lib/lexical/exts/md-commands'
import { ToolbarContextProvider } from '@/components/editor/contexts/toolbar'
import { ToolbarPlugin } from '@/components/editor/plugins/toolbar'
import FormikBridgePlugin from '@/components/editor/plugins/core/formik'
import LocalDraftPlugin from '@/components/editor/plugins/core/local-draft'
import { MaxLengthPlugin } from '@/components/editor/plugins/core/max-length'
import MentionsPlugin from '@/components/editor/plugins/mentions'
import FileUploadPlugin from '@/components/editor/plugins/upload'
import PreviewPlugin from '@/components/editor/plugins/preview'
import { $initializeEditorState } from '@/lib/lexical/utils'
import theme from '@/lib/lexical/theme'
import styles from '@/lib/lexical/theme/editor.module.css'
import { HistoryExtension } from '@lexical/history'
import useCallbackRef from '../use-callback-ref'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { ApplePatchExtension } from '@/lib/lexical/exts/apple'
import { SoftkeyUnborkerPlugin } from '@/components/editor/plugins/patch/softkey-unborker'
import { SoftkeyEmptyGuardPlugin } from '@/components/editor/plugins/patch/softkey-emptyguard'

/**
 * main lexical editor component with formik integration
 * @param {string} props.name - form field name
 * @param {string} [props.appendValue] - value to append to initial content
 * @param {boolean} [props.autoFocus] - whether to auto-focus the editor
 * @returns {JSX.Element} lexical editor component
 */
export default function Editor ({ name, appendValue, autoFocus, topLevel, ...props }) {
  const [text] = useField({ name })

  const editor = useMemo(() =>
    defineExtension({
      $initialEditorState: () => {
        // initialize editor state with appendValue or existing formik text
        if (appendValue || text.value) {
          $initializeEditorState(appendValue || text.value)
        }
      },
      name: 'editor',
      namespace: 'sn',
      dependencies: [
        PlainTextExtension,
        ApplePatchExtension,
        HistoryExtension,
        ShortcutsExtension,
        MDCommandsExtension,
        configExtension(ReactExtension, { contentEditable: null }),
        configExtension(AutoFocusExtension, { disabled: !autoFocus })
      ],
      theme: { ...theme, topLevel: topLevel ? 'sn-text--top-level' : '' },
      onError: (error) => console.error('editor has encountered an error:', error)
    // only depend on stable values to avoid unnecessary re-renders
    // appendValue and text.value are, for example, not stable because they are updated by the formik context
    }), [autoFocus, topLevel])

  return (
    <LexicalExtensionComposer extension={editor} contentEditable={null}>
      <ToolbarContextProvider>
        <EditorContent topLevel={topLevel} name={name} {...props} />
      </ToolbarContextProvider>
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
function EditorContent ({ name, placeholder, lengthOptions, topLevel, required = false, minRows, hint, warn, editorRef }) {
  const { ref: containerRef, onRef: onContainerRef } = useCallbackRef()

  return (
    <div className={classNames(styles.editorContainer)} data-top-level={topLevel ? 'true' : 'false'}>
      <EditorRefPlugin editorRef={editorRef} />
      <ToolbarPlugin topLevel={topLevel} name={name} />
      {/* we only need a plain text editor for markdown */}
      <div className={styles.editor} ref={onContainerRef}>
        <ContentEditable
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
      {containerRef && <PreviewPlugin editorRef={containerRef} topLevel={topLevel} name={name} />}
      <FileUploadPlugin editorRef={containerRef} />
      <MentionsPlugin />
      <LocalDraftPlugin name={name} />
      <FormikBridgePlugin name={name} />
      <MaxLengthPlugin lengthOptions={lengthOptions} />
      <SoftkeyUnborkerPlugin />
      <SoftkeyEmptyGuardPlugin />
      {hint && <BootstrapForm.Text>{hint}</BootstrapForm.Text>}
      {warn && <BootstrapForm.Text className='text-warning'>{warn}</BootstrapForm.Text>}
    </div>
  )
}
