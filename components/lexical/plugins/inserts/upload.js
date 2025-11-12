import { useEffect, useRef, useCallback } from 'react'
import {
  COMMAND_PRIORITY_EDITOR,
  $createParagraphNode, $createTextNode, $getNodeByKey, $insertNodes, $getRoot, $nodesOfType,
  $getSelection, $isRangeSelection, $selectAll,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  $isRootOrShadowRoot
} from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useFeeButton } from '@/components/fee-button'
import { FileUpload } from '@/components/file-upload'
import { SN_UPLOAD_FILES_COMMAND } from '@/lib/lexical/universal/commands/upload'
import { gql, useLazyQuery } from '@apollo/client'
import { numWithUnits } from '@/lib/format'
import { $isMarkdownMode } from '@/lib/lexical/universal/utils'
import { MediaNode, $createMediaNode } from '@/lib/lexical/nodes/content/media'
import { AWS_S3_URL_REGEXP } from '@/lib/constants'
import useDebounceCallback from '@/components/use-debounce-callback'
import styles from '@/components/lexical/theme/theme.module.css'

/**
 * plugin that handles file uploads with progress tracking and fee calcs
 * @returns {JSX.Element} hidden file upload input component
 */
export default function FileUploadPlugin ({ anchorElem = document.body }) {
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

  const uploadProgressNode = (file, percent) => {
    // TODO: create a node for the upload progress bar with the event, then we replace it with the actual node
    const node = $createTextNode(`Uploading ${file.name}… ${percent}%`)
    return node
  }
  // todo: this is too messy
  // instant version for onSuccess
  const $refreshUploadFees = useCallback(() => {
    let s3Keys = []
    if ($isMarkdownMode()) {
      const text = $getRoot().getFirstChild()?.getTextContent() || ''
      s3Keys = [...text.matchAll(AWS_S3_URL_REGEXP)].map(m => Number(m[1]))
    } else {
      const nodes = $nodesOfType(MediaNode)
      const srcs = nodes.filter(node => node.getSrc()).map(node => node.getSrc()).join(',')
      s3Keys = [...srcs.matchAll(AWS_S3_URL_REGEXP)].map(m => Number(m[1]))
    }
    updateUploadFees({ variables: { s3Keys } })
  }, [updateUploadFees])

  // debounced version for update listener
  const refreshUploadFeesDebounced = useDebounceCallback(() => {
    editor.getEditorState().read(() => {
      $refreshUploadFees()
    })
  }, 1000, [$refreshUploadFees])

  const onConfirm = useCallback((files) => {
    editor.update(() => {
      const selection = $getSelection()

      if ($isMarkdownMode()) {
        files.forEach(file => {
          const identifier = Math.random().toString(36).substring(2, 8)
          selection.insertText(`\n\n![Uploading ${file.name}… 0%](${identifier})`)
          placeholdersRef.current.set(file, identifier)
        })
        return
      }

      if ($isRangeSelection(selection)) {
        // move selection to end of current paragraph
        const anchorNode = selection.anchor.getNode()
        const topLevelElement = $isRootOrShadowRoot(anchorNode)
          ? anchorNode.getFirstChild()
          : anchorNode.getTopLevelElementOrThrow()

        // insert a new paragraph
        const newParagraph = $createParagraphNode()
        topLevelElement.insertAfter(newParagraph)
        newParagraph.select()
      }

      const nodes = files.map(file => {
        const node = uploadProgressNode(file, 0)
        placeholdersRef.current.set(file, node.getKey())
        return node
      })

      // insert each node separately with line breaks
      nodes.forEach(node => {
        $insertNodes([node])
        $insertNodes([$createParagraphNode()])
      })
    }, { tag: 'history-merge' })
    setSubmitDisabled?.(true)
  }, [editor, setSubmitDisabled])

  const onProgress = useCallback(({ file, loaded, total }) => {
    const key = placeholdersRef.current.get(file)
    if (!key) return
    editor.update(() => {
      if ($isMarkdownMode()) {
        const markdownNode = $getRoot().getFirstChild()
        const text = markdownNode?.getTextContent() || ''
        const percent = total ? Math.floor((loaded / total) * 100) : 0
        const regex = new RegExp(`!\\[Uploading ${file.name}… \\d+%\\]\\(${key}\\)`)
        const newText = text.replace(regex, `![Uploading ${file.name}… ${percent}%](${key})`)

        // wip: this basically blocks editor updates, seems to be the only reliable way to replace text in markdown
        $selectAll()
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            selection.insertText(newText)
          }
        })
        return
      }
      const node = $getNodeByKey(key)
      const percent = total ? Math.floor((loaded / total) * 100) : 0
      node?.setTextContent(`Uploading ${file.name}… ${percent}%`)
    }, { tag: 'history-merge' })
  }, [editor])

  const onSuccess = useCallback(({ url, name, id, file }) => {
    const key = placeholdersRef.current.get(file)
    if (!key) return
    editor.update(() => {
      const node = $getNodeByKey(key)
      placeholdersRef.current.delete(file)
      if ($isMarkdownMode()) {
        const markdownNode = $getRoot().getFirstChild()
        const text = markdownNode?.getTextContent() || ''
        const regex = new RegExp(`!\\[Uploading ${file.name}… \\d+%\\]\\(${key}\\)`)
        const newText = text.replace(regex, `![](${url})`)
        $selectAll()
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            selection.insertText(newText)
          }
        })
      } else {
        node.replace($createMediaNode({ src: url }))
      }
    })
    // refresh upload fees after the update is complete
    editor.read(() => $refreshUploadFees())
    setSubmitDisabled?.(false)
  }, [editor, setSubmitDisabled])

  const onError = useCallback(({ file }) => {
    const key = placeholdersRef.current.get(file)
    if (!key) return
    editor.update(() => {
      const node = $getNodeByKey(key)
      node?.remove()
      placeholdersRef.current.delete(file)
    }, { tag: 'history-merge' })
    setSubmitDisabled?.(false)
  }, [editor, setSubmitDisabled])

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SN_UPLOAD_FILES_COMMAND,
        () => {
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

  // updates upload fees the moment media nodes are created or destroyed
  useEffect(() => {
    return editor.registerMutationListener(MediaNode, (mutations) => {
      editor.getEditorState().read(() => {
        if ($isMarkdownMode()) return
        for (const [, type] of mutations) {
          if (type === 'created' || type === 'destroyed') {
            $refreshUploadFees()
          }
        }
      })
    })
  }, [editor, $refreshUploadFees])

  // drag'n'drop + paste file handling
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
          const rootElement = editor.getRootElement()
          if (rootElement) {
            rootElement.classList.add(styles.dragOver)
          }
          return true
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        DROP_COMMAND,
        (e) => {
          e.preventDefault()
          editor.getRootElement().classList.remove(styles.dragOver)
          const changeEvent = new Event('change', { bubbles: true })
          fileInputRef.current.files = e.dataTransfer.files
          fileInputRef.current.dispatchEvent(changeEvent)
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

    if (anchorElem) {
      anchorElem.addEventListener('dragleave', onDragLeave)
    }
    return () => {
      unregisters()
      if (anchorElem) {
        anchorElem.removeEventListener('dragleave', onDragLeave)
      }
    }
  }, [editor, anchorElem])

  return (
    <div className='d-none'>
      <FileUpload
        multiple
        ref={fileInputRef}
        onConfirm={onConfirm}
        onProgress={onProgress}
        onSuccess={onSuccess}
        onError={onError}
      />
    </div>
  )
}
