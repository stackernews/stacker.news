import { headingsPlugin, thematicBreakPlugin, markdownShortcutPlugin, listsPlugin, quotePlugin, MDXEditor } from '@mdxeditor/editor'
import { useFormikContext } from 'formik'
import { useCallback } from 'react'
import classNames from 'classnames'
import styles from './editor.module.css'
import { localDraftPlugin } from './plugins/core/local-draft'

export default function Editor ({ editorRef, name, lengthOptions, autoFocus, appendValue, placeholder, className, topLevel, storageKey, ...props }) {
  const { values, setFieldValue } = useFormikContext()

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
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        markdownShortcutPlugin(),
        // realm plugin to store the draft in local storage
        localDraftPlugin({ storageKey })
      ]}
      ref={editorRef}
    />
  )
}
