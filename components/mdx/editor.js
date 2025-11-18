import {
  headingsPlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  listsPlugin,
  quotePlugin,
  toolbarPlugin,
  MDXEditor,
  diffSourcePlugin
} from '@mdxeditor/editor'
import { useFormikContext } from 'formik'
import { useCallback, useMemo } from 'react'
import classNames from 'classnames'
import styles from './editor.module.css'
import { localDraftPlugin } from './plugins/core/local-draft'
import '@mdxeditor/editor/style.css'
import FullToolbar from './plugins/toolbar'

export default function Editor ({ editorRef, name, lengthOptions, autoFocus, appendValue, placeholder, className, topLevel, storageKey, isEdit, ...props }) {
  const { values, setFieldValue } = useFormikContext()
  const originalText = useMemo(() => values[name] || '', [])

  const handleChange = useCallback((value) => {
    if (lengthOptions?.max && value.length > lengthOptions.max) return
    setFieldValue(name, value)
  }, [setFieldValue, name, lengthOptions])

  return (
    <MDXEditor
      {...props}
      className={classNames(styles.editor, className)}
      contentEditableClassName={classNames(styles.editorInput, styles.text, topLevel && 'topLevel')}
      markdown={appendValue || values[name] || ''}
      onChange={handleChange}
      autoFocus={autoFocus}
      placeholder={placeholder}
      plugins={[
        toolbarPlugin({
          toolbarClassName: styles.toolbar,
          toolbarContents: () => <FullToolbar isEdit={isEdit} />
        }),
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        markdownShortcutPlugin(),
        // realm plugin to store the draft in local storage
        localDraftPlugin({ storageKey }),
        diffSourcePlugin({ viewMode: 'source', diffMarkdown: originalText })
      ]}
      ref={editorRef}
    />
  )
}
