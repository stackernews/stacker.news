import { useEffect, useRef, useCallback } from 'react'
import {
  COMMAND_PRIORITY_EDITOR,
  $createParagraphNode, $createTextNode, $getNodeByKey, $insertNodes, $getRoot, $nodesOfType
} from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useFeeButton } from '@/components/fee-button'
import { FileUpload } from '@/components/file-upload'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/lexical/universal/commands/upload'
import { gql, useLazyQuery } from '@apollo/client'
import { numWithUnits } from '@/lib/format'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { MediaNode, $createMediaNode } from '@/lib/lexical/nodes/content/media/media'
import { AWS_S3_URL_REGEXP } from '@/lib/constants'
import useDebounceCallback from '@/components/use-debounce-callback'

export default function FileUploadPlugin () {
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
      console.log('uploadFees', uploadFees)
      const { uploadFees: feePerUpload, nUnpaid } = uploadFees
      const totalFees = feePerUpload * nUnpaid
      console.log('totalFees', totalFees)
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
  const $refreshUploadFeesDebounced = useDebounceCallback(() => {
    editor.getEditorState().read(() => {
      $refreshUploadFees()
    })
  }, 1000, [$refreshUploadFees])

  const onConfirm = useCallback((files) => {
    editor.update(() => {
      const nodes = files.map(file => {
        const node = uploadProgressNode(file, 0)
        placeholdersRef.current.set(file, node.getKey())
        return node
      })
      // insert each node separately with line breaks
      // but there might be a better way to do this
      nodes.forEach(node => {
        $insertNodes([node])
        $insertNodes([$createParagraphNode()])
      })
    })
    setSubmitDisabled?.(true)
  }, [editor, setSubmitDisabled])

  const onProgress = useCallback(({ file, loaded, total }) => {
    const key = placeholdersRef.current.get(file)
    if (!key) return
    editor.update(() => {
      const node = $getNodeByKey(key)
      const percent = total ? Math.floor((loaded / total) * 100) : 0
      node?.setTextContent(`Uploading ${file.name}… ${percent}%`)
    })
  }, [editor])

  const onSuccess = useCallback(({ url, name, id, file }) => {
    const key = placeholdersRef.current.get(file)
    if (!key) return
    editor.update(() => {
      const node = $getNodeByKey(key)
      placeholdersRef.current.delete(file)
      const nodes = [$createMediaNode({ src: url })]
      nodes.forEach(mediaNode => node.replace(mediaNode))
    })
    setSubmitDisabled?.(false)
  }, [editor, setSubmitDisabled])

  const onError = useCallback(({ file }) => {
    const key = placeholdersRef.current.get(file)
    if (!key) return
    editor.update(() => {
      const node = $getNodeByKey(key)
      node?.remove()
      placeholdersRef.current.delete(file)
    })
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
    return editor.registerUpdateListener(({ editorState }) => {
      $refreshUploadFeesDebounced()
    })
  }, [editor, $refreshUploadFeesDebounced])

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
