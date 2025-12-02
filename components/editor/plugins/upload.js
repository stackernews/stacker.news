import { useEffect, useRef, useCallback } from 'react'
import {
  COMMAND_PRIORITY_EDITOR,
  $getRoot,
  $getSelection, $isRangeSelection, $selectAll,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  createCommand
} from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useFeeButton } from '@/components/fee-button'
import { FileUpload } from '@/components/file-upload'
import { gql, useLazyQuery } from '@apollo/client'
import { numWithUnits } from '@/lib/format'
import { AWS_S3_URL_REGEXP } from '@/lib/constants'
import useDebounceCallback from '@/components/use-debounce-callback'
import styles from '@/components/editor/theme/editor.module.css'

export const SN_UPLOAD_FILES_COMMAND = createCommand('SN_UPLOAD_FILES_COMMAND')

/**
 * plugin that handles file uploads with progress tracking and fee calcs
 * @returns {JSX.Element} hidden file upload input component
 */
export default function FileUploadPlugin ({ editorRef }) {
  const [editor] = useLexicalComposerContext()
  const placeholdersRef = useRef(new Map())
  const fileInputRef = useRef(null)
  const { merge, setDisabled: setSubmitDisabled } = useFeeButton()
  // this receives the count of uploaded files and updates the upload fees
  // in rich mode we can count MediaNodes with getUploaded()
  // in markdown mode we can directly pass the text content on updateListener and regex it
  const [updateUploadFees] = useLazyQuery(gql`
    query uploadFees($s3Keys: [Int]!) {
      uploadFees(s3Keys: $s3Keys) {
        nUnpaid
        uploadFees
      }
    }`, {
    fetchPolicy: 'no-cache',
    nextFetchPolicy: 'no-cache',
    onError: (err) => {
      console.error(err)
    },
    onCompleted: ({ uploadFees }) => {
      const { uploadFees: feePerUpload, nUnpaid } = uploadFees
      const totalFees = feePerUpload * nUnpaid
      merge({
        uploadFees: {
          term: `+ ${numWithUnits(feePerUpload, { abbreviate: false })} x ${nUnpaid}`,
          label: 'upload fee',
          op: '+',
          modifier: cost => cost + totalFees,
          omit: !totalFees
        }
      })
    }
  })

  // todo: this is too messy
  // instant version for onSuccess
  const $refreshUploadFees = useCallback(() => {
    let s3Keys = []
    const text = $getRoot().getTextContent() || ''
    s3Keys = [...text.matchAll(AWS_S3_URL_REGEXP)].map(m => Number(m[1]))
    updateUploadFees({ variables: { s3Keys } })
  }, [updateUploadFees])

  // debounced version for update listener
  const refreshUploadFeesDebounced = useDebounceCallback(() => {
    editor.getEditorState().read(() => {
      $refreshUploadFees()
    })
  }, 1000, [$refreshUploadFees])

  const onUpload = useCallback((file) => {
    editor.update(() => {
      const selection = $getSelection()
      const identifier = Math.random().toString(36).substring(2, 8)
      selection.insertText(`\n\n![Uploading ${file.name}…](${identifier})`)
      placeholdersRef.current.set(file, identifier)
    }, { tag: 'history-merge' })
    setSubmitDisabled?.(true)
  }, [editor, setSubmitDisabled])

  const onSuccess = useCallback(({ url, name, id, file }) => {
    const identifier = placeholdersRef.current.get(file)
    if (!identifier) return
    editor.update(() => {
      placeholdersRef.current.delete(file)
      let text = $getRoot().getTextContent() || ''
      text = text.replace(`![Uploading ${name}…](${identifier})`, `![](${url})`)
      $selectAll()
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertText(text)
      }
      console.log('onSuccess markdown', text)
    }, { tag: 'history-merge' })
    // refresh upload fees after the update is complete
    editor.read(() => $refreshUploadFees())
    setSubmitDisabled?.(false)
  }, [editor, setSubmitDisabled])

  const onError = useCallback(({ file }) => {
    const identifier = placeholdersRef.current.get(file)
    if (!identifier) return
    editor.update(() => {
      placeholdersRef.current.delete(file)
      let text = $getRoot().getTextContent() || ''
      text = text.replace(`![Uploading ${file.name}…](${identifier})`, '')
      $selectAll()
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertText(text)
      }
    }, { tag: 'history-merge' })
    setSubmitDisabled?.(false)
  }, [editor, setSubmitDisabled])

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SN_UPLOAD_FILES_COMMAND,
        () => {
          if (!editor.isEditable()) return false

          fileInputRef.current?.click()
          return true
        },
        COMMAND_PRIORITY_EDITOR
      )
    )
  }, [editor])

  // update upload fees when the editor state changes in any way, debounced
  useEffect(() => {
    return editor.registerUpdateListener(() =>
      refreshUploadFeesDebounced()
    )
  }, [editor, refreshUploadFeesDebounced])

  // drag'n'drop + paste file handling
  useEffect(() => {
    const unregisters = mergeRegister(
      editor.registerCommand(
        PASTE_COMMAND,
        (e) => {
          const items = e.clipboardData?.items || []
          if (items.length === 0) return false
          console.log('paste command', items)

          const fileList = new window.DataTransfer()
          let hasImages = false

          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            console.log('item', item)
            if (item.type.startsWith('image')) {
              const blob = item.getAsFile()
              const file = new File([blob], 'image', { type: blob.type })
              fileList.items.add(file)
              hasImages = true
            }
          }

          if (hasImages) {
            console.log('has images', hasImages)
            e.preventDefault()
            const changeEvent = new Event('change', { bubbles: true })
            fileInputRef.current.files = fileList.files
            fileInputRef.current.dispatchEvent(changeEvent)
          }

          console.log('return', hasImages)
          return hasImages
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        DRAGOVER_COMMAND,
        (e) => {
          const rootElement = editor.getRootElement()
          if (rootElement) {
            rootElement.classList.add(styles.dragOver)
          }
          return true
        },
        COMMAND_PRIORITY_LOW
      ),
      // TODO: this doesn't handle selection, won't create a selection
      // use MediaNode DnD to figure this out
      editor.registerCommand(
        DROP_COMMAND,
        (e) => {
          e.preventDefault()
          const rootElement = editor.getRootElement()
          if (rootElement) {
            rootElement.classList.remove(styles.dragOver)
          }
          console.log('drop command', e.dataTransfer.files)
          const changeEvent = new Event('change', { bubbles: true })
          fileInputRef.current.files = e.dataTransfer.files
          fileInputRef.current.dispatchEvent(changeEvent)
          console.log('return', e.dataTransfer.files)
          return true
        },
        COMMAND_PRIORITY_LOW
      )
    )

    const onDragLeave = () => {
      const rootElement = editor.getRootElement()
      if (rootElement) {
        rootElement.classList.remove(styles.dragOver)
      }
    }

    if (editorRef) {
      editorRef.addEventListener('dragleave', onDragLeave)
    }
    return () => {
      unregisters()
      if (editorRef) {
        editorRef.removeEventListener('dragleave', onDragLeave)
      }
    }
  }, [editor, editorRef])

  useEffect(() => {
    return () => {
      placeholdersRef.current.clear()
    }
  }, [placeholdersRef])

  return (
    <div className='d-none'>
      <FileUpload
        multiple
        ref={fileInputRef}
        onUpload={onUpload}
        onSuccess={onSuccess}
        onError={onError}
      />
    </div>
  )
}
