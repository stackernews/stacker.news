import FormikBridgePlugin from '@/components/editor/plugins/formik'
import LocalDraftPlugin from '@/components/editor/plugins/local-draft'
import { MaxLengthPlugin } from '@/components/editor/plugins/max-length'
import MentionsPlugin from '@/components/editor/plugins/mention'
import FileUploadPlugin from '@/components/editor/plugins/upload'
import PreviewPlugin from '@/components/editor/plugins/preview'
import { AutoFocusExtension } from '@lexical/extension'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import classNames from 'classnames'
import { useFormikContext } from 'formik'
import { configExtension, defineExtension } from 'lexical'
import { useMemo, useState } from 'react'
import theme from '@/lib/lexical/theme'
import styles from '@/lib/lexical/theme/editor.module.css'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { ToolbarPlugin } from '@/components/editor/plugins/toolbar'
import { ToolbarContextProvider } from '@/components/editor/contexts/toolbar'
import { $initializeEditorState } from '@/lib/lexical/utils'
import BootstrapForm from 'react-bootstrap/Form'

/**
 * main lexical editor component with formik integration
 * @param {string} props.name - form field name
 * @param {string} [props.appendValue] - value to append to initial content
 * @param {boolean} [props.autoFocus] - whether to auto-focus the editor
 * @returns {JSX.Element} lexical editor component
 */
export default function SNEditor ({ name, appendValue, autoFocus, topLevel, ...props }) {
  const { values } = useFormikContext()

  const editor = useMemo(() =>
    defineExtension({
      $initialEditorState: (editor) => {
        // initialize editor state with appendValue or existing formik text
        if (appendValue || values.text) {
          $initializeEditorState(editor, appendValue ?? values.text)
        }
      },
      name: 'editor',
      namespace: 'sn',
      dependencies: [
        configExtension(AutoFocusExtension, { disabled: !autoFocus })
      ],
      theme: { ...theme, topLevel: topLevel ? 'sn__topLevel' : '' },
      onError: (error) => console.error('editor has encountered an error:', error)
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
function EditorContent ({ name, placeholder, lengthOptions, topLevel, required = false, minRows = 6, hint, warn }) {
  const [editorRef, setEditorRef] = useState(null)

  const onRef = (_editorRef) => {
    if (_editorRef !== null) {
      setEditorRef(_editorRef)
    }
  }

  return (
    <>
      <div className={classNames(styles.editorContainer, topLevel && 'sn__topLevel')}>
        <ToolbarPlugin topLevel={topLevel} />
        {/* we only need a plain text editor for markdown */}
        <PlainTextPlugin
          contentEditable={
            <div className={styles.editor} ref={onRef}>
              <ContentEditable
                className={classNames(styles.editorInput, 'sn__text')}
                /* lh is a css unit that is equal to the line height of the element
                   probably the worst thing is that we have to add 1 to the minRows to get the correct height
                */
                style={{ minHeight: `${(minRows + 1)}lh` }}
                placeholder={<div className={styles.editorPlaceholder}>{placeholder}</div>}
                aria-required={required}
              />
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {editorRef && <PreviewPlugin editorRef={editorRef} topLevel={topLevel} />}
        <FileUploadPlugin editorRef={editorRef} />
        <MentionsPlugin />
        <LocalDraftPlugin name={name} />
        <FormikBridgePlugin />
        <MaxLengthPlugin lengthOptions={lengthOptions} />
        {hint && <BootstrapForm.Text>{hint}</BootstrapForm.Text>}
        {warn && <BootstrapForm.Text className='text-warning'>{warn}</BootstrapForm.Text>}
      </div>
    </>
  )
}
