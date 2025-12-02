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
import theme from './theme'
import styles from './theme/editor.module.css'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { ToolbarPlugin } from './plugins/tinytoolbar'
import { ToolbarContextProvider } from './contexts/toolbar'
import { $initializeEditorState } from '@/lib/lexical/utils'

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
 * @returns {JSX.Element} editor content with all plugins
 */
function EditorContent ({ name, placeholder, lengthOptions, topLevel }) {
  const [floatingAnchorElem, setFloatingAnchorElem] = useState(null)

  const onRef = (_floatingAnchorElem) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem)
    }
  }

  return (
    <>
      <div className={styles.editorContainer}>
        <ToolbarPlugin topLevel={topLevel} />
        {/* we only need a plain text editor for markdown */}
        <PlainTextPlugin
          contentEditable={
            <div className={styles.editor} ref={onRef}>
              <ContentEditable
                className={classNames(styles.editorInput, 'sn__text', topLevel && 'sn__topLevel')}
                placeholder={<div className={styles.editorPlaceholder}>{placeholder}</div>}
              />
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {floatingAnchorElem && <PreviewPlugin editorRef={floatingAnchorElem} topLevel={topLevel} />}
        <FileUploadPlugin anchorElem={floatingAnchorElem} />
        <MentionsPlugin />
        <MaxLengthPlugin lengthOptions={lengthOptions} />
        <LocalDraftPlugin name={name} />
        <FormikBridgePlugin />
      </div>
    </>
  )
}
