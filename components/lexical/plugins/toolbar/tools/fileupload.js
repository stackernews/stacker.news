import styles from '@/components/lexical/theme/theme.module.css'
import { useRef, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_EDITOR } from 'lexical'
import AddFileIcon from '@/svgs/file-upload-line.svg'
import { FileUpload } from '@/components/file-upload'
const INSERT_FILES_COMMAND = createCommand()

export default function FileUploadPlugin () {
  const [editor] = useLexicalComposerContext()
  const fileInputRef = useRef(null)

  // cool now we have to create logic to actually set the text in the editor, see form.js
  useEffect(() => {
    return editor.registerCommand(INSERT_FILES_COMMAND, (files) => {
      console.log(files)
      return true
    }, COMMAND_PRIORITY_EDITOR)
  }, [editor])

  return (
    <div className={styles.fileUpload} title='upload media'>
      <FileUpload
        multiple
        ref={fileInputRef}
      >
        <AddFileIcon width={18} height={18} />
      </FileUpload>
    </div>
  )
}
