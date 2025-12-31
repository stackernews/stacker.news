import { useEffect, useRef, useCallback } from 'react'
import {
  COMMAND_PRIORITY_EDITOR,
  $getRoot,
  $getNodeByKey,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  createCommand,
  $createTextNode,
  $createRangeSelection,
  $setSelection
} from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { gql, useLazyQuery } from '@apollo/client'
import { useFeeButton } from '@/components/fee-button'
import { FileUpload } from '@/components/file-upload'
import useDebounceCallback from '@/components/use-debounce-callback'
import { numWithUnits } from '@/lib/format'
import { AWS_S3_URL_REGEXP } from '@/lib/constants'
import { getDragSelection } from '@/lib/lexical/utils/dom'
import styles from '@/lib/lexical/theme/editor.module.css'
import { $insertTextAtSelection } from '@/lib/lexical/utils'

export const SN_UPLOAD_FILES_COMMAND = createCommand('SN_UPLOAD_FILES_COMMAND')

const UPLOAD_FEES_QUERY = gql`
  query uploadFees($s3Keys: [Int]!) {
    uploadFees(s3Keys: $s3Keys) {
      nUnpaid
      uploadFees
    }
  }
`

/**
 * plugin that handles file uploads and fee calculations
 * @returns {JSX.Element} hidden file upload input component
 */
export default function FileUploadPlugin ({ editorRef }) {
  const [editor] = useLexicalComposerContext()
  const placeholderKey = useRef(0)
  const fileInputRef = useRef(null)
  const { setDisabled: setSubmitDisabled } = useFeeButton()
  const { $refreshUploadFees } = useLexicalUploadFees(editor)

  // replace placeholder text in editor
  const replacePlaceholder = useCallback((newText) => {
    editor.update(() => {
      const placeholderNode = $getNodeByKey(placeholderKey.current)
      if (placeholderNode) {
        placeholderNode.setTextContent(newText)
        // move selection to end of the replaced node to avoid stale offset errors
        // (the old selection offset may exceed the new text length)
        placeholderNode.selectEnd()
      }
    }, { tag: 'history-merge' })
  }, [editor, placeholderKey])

  // upload event handler
  // creates a placeholder node with the file name
  // inserts it into the editor at the selection or the root if there is no selection
  const onUpload = useCallback((file) => {
    editor.update(() => {
      // placeholderKey is the nodekey of the TextNode that contains the placeholder text
      const placeholderNode = $createTextNode(`![Uploading ${file.name}…]()`)
      $insertTextAtSelection(placeholderNode, 2)
      // update the placeholder key
      placeholderKey.current = placeholderNode.getKey()
    }, { tag: 'history-merge' })

    setSubmitDisabled?.(true)
  }, [editor, setSubmitDisabled])

  // success event handler
  // replaces the placeholder with the image url
  const onSuccess = useCallback(({ url, name, file }) => {
    replacePlaceholder(`![](${url})`)

    // refresh upload fees
    editor.read(() => $refreshUploadFees())
    setSubmitDisabled?.(false)
  }, [editor, replacePlaceholder, $refreshUploadFees, setSubmitDisabled])

  const onError = useCallback(({ file }) => {
    replacePlaceholder('')
    setSubmitDisabled?.(false)
  }, [replacePlaceholder, setSubmitDisabled])

  // drop event handler
  // sets lexical selection to the drag selection
  // and dispatches a change event to the file input
  const $onDrop = useCallback((e) => {
    e.preventDefault()
    if (editorRef) {
      editorRef.classList.remove(styles.dragOver)
    }

    // set lexical selection to the drag selection
    const range = getDragSelection(e)
    const rangeSelection = $createRangeSelection(range)
    if (range) {
      rangeSelection.applyDOMRange(range)
    }
    $setSelection(rangeSelection)

    const changeEvent = new Event('change', { bubbles: true })
    fileInputRef.current.files = e.dataTransfer.files
    fileInputRef.current.dispatchEvent(changeEvent)
  }, [editorRef])

  // command that opens the file upload dialog
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

  // command listeners
  // paste, dragover, drop
  useEffect(() => {
    const unregisters = mergeRegister(
      editor.registerCommand(
        PASTE_COMMAND,
        (e) => {
          const items = e.clipboardData?.items || []
          if (items.length === 0) return false

          const fileList = new window.DataTransfer()
          let hasImages = false

          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image')) {
              const blob = item.getAsFile()
              if (!blob) continue
              const file = new File([blob], 'image', { type: blob.type })
              fileList.items.add(file)
              hasImages = true
            }
          }

          if (hasImages) {
            e.preventDefault()
            const changeEvent = new Event('change', { bubbles: true })
            fileInputRef.current.files = fileList.files
            fileInputRef.current.dispatchEvent(changeEvent)
          }

          return hasImages
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        DRAGOVER_COMMAND,
        (e) => {
          if (editorRef) {
            editorRef.classList.add(styles.dragOver)
          }
          return true
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        DROP_COMMAND,
        (e) => {
          $onDrop(e)
          return true
        },
        COMMAND_PRIORITY_LOW
      )
    )

    const onDragLeave = () => {
      if (editorRef) {
        editorRef.classList.remove(styles.dragOver)
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

  // cleanup
  useEffect(() => {
    return () => {
      placeholderKey.current = 0
    }
  }, [placeholderKey])

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

/**
 * hook for upload fees calculations
 *
 * updates the upload fees in the fee button when the editor state changes
 *
 * @param {Object} editor - lexical editor instance
 * @returns {Object} instant $refreshUploadFees function
 *
 * @example
 * ```javascript
 * const { $refreshUploadFees } = useLexicalUploadFees(editor)
 * $refreshUploadFees()
 * ```
 */
function useLexicalUploadFees (editor) {
  const { merge } = useFeeButton()

  const [updateUploadFees] = useLazyQuery(UPLOAD_FEES_QUERY, {
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

  // extracts S3 keys from text and updates upload fees
  const $refreshUploadFees = useCallback(() => {
    const text = $getRoot().getTextContent() || ''
    const s3Keys = [...text.matchAll(AWS_S3_URL_REGEXP)].map(m => Number(m[1]))
    updateUploadFees({ variables: { s3Keys } })
  }, [updateUploadFees])

  // debounced version for update listener
  const refreshUploadFeesDebounced = useDebounceCallback(() => {
    editor.getEditorState().read(() => {
      $refreshUploadFees()
    })
  }, 1000, [$refreshUploadFees])

  // update upload fees when the editor state changes
  useEffect(() => {
    return editor.registerUpdateListener(() =>
      refreshUploadFeesDebounced()
    )
  }, [editor, refreshUploadFeesDebounced])

  return { $refreshUploadFees }
}
