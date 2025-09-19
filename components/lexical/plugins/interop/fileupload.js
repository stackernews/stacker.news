import styles from '@/components/lexical/styles/theme.module.css'
import { useRef, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_EDITOR, $insertNodes, $createTextNode, $getNodeByKey, $createParagraphNode } from 'lexical'
import AddFileIcon from '@/svgs/file-upload-line.svg'
import { FileUpload } from '@/components/file-upload'
import { useFeeButton } from '@/components/fee-button'
// import { useLazyQuery } from '@apollo/client'
// import { gql } from 'graphql-tag'
// import { numWithUnits } from '@/lib/format'
import { $createMediaOrLinkNode } from '@/lib/lexical/nodes/mediaorlink'
const INSERT_FILES_COMMAND = createCommand()

export default function FileUploadPlugin () {
  const fileInputRef = useRef(null)
  const [editor] = useLexicalComposerContext()
  const { /* merge, */setDisabled: setSubmitDisabled } = useFeeButton()
  const placeholdersRef = useRef(new Map())
  // wip: File Upload Fees
  // const [updateUploadFees] = useLazyQuery(gql`
  //   query uploadFees($s3Keys: [Int]!) {
  //     uploadFees(s3Keys: $s3Keys) {
  //       nUnpaid
  //       uploadFees
  //     }
  //   }`, {
  //   fetchPolicy: 'no-cache',
  //   nextFetchPolicy: 'no-cache',
  //   onError: (err) => {
  //     console.error(err)
  //   },
  //   onCompleted: ({ uploadFees }) => {
  //     const { uploadFees: feePerUpload, nUnpaid } = uploadFees
  //     const totalFees = feePerUpload * nUnpaid
  //     merge({
  //       uploadFees: {
  //         term: `+ ${numWithUnits(feePerUpload, { abbreviate: false })} x ${nUnpaid}`,
  //         label: 'upload fee',
  //         op: '+',
  //         modifier: cost => cost + totalFees,
  //         omit: !totalFees
  //       }
  //     })
  //   }
  // })

  const uploadProgressNode = (file, percent) => {
    // TODO: create a node for the upload progress bar with the event, then we replace it with the actual node
    const node = $createTextNode(`Uploading ${file.name}… ${percent}%`)
    return node
  }

  // cool now we have to create logic to actually set the text in the editor, see form.js
  useEffect(() => {
    return editor.registerCommand(INSERT_FILES_COMMAND, (files) => {
      editor.update(() => {
        // create node
        const nodes = files.map(file => $createMediaOrLinkNode({ src: file.url, rel: 'noopener noreferrer', name: file.name }))
        $insertNodes(nodes)
      })
      return true
    }, COMMAND_PRIORITY_EDITOR)
  }, [editor])

  return (
    <div className={styles.fileUpload} title='upload media'>
      <FileUpload
        multiple
        ref={fileInputRef}
        onConfirm={(files) => {
          console.log('onConfirm', files)
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
        }}
        onProgress={({ file, loaded, total }) => {
          console.log('onProgress', file, loaded, total)
          const key = placeholdersRef.current.get(file)
          if (!key) return
          editor.update(() => {
            const node = $getNodeByKey(key)
            const percent = total ? Math.floor((loaded / total) * 100) : 0
            node?.setTextContent(`Uploading ${file.name}… ${percent}%`)
          })
        }}
        onSuccess={({ url, name, file }) => {
          console.log('onSuccess', url, name, file)
          const key = placeholdersRef.current.get(file)
          if (!key) return
          editor.update(() => {
            const node = $getNodeByKey(key)
            placeholdersRef.current.delete(file)
            const nodes = [$createMediaOrLinkNode({ src: url, rel: 'noopener noreferrer', name })]
            nodes.forEach(mediaNode => node.replace(mediaNode))
          })

          // updateUploadFees({ variables: { s3Keys: [Number(id)] } })
          setSubmitDisabled?.(false)
        }}
        onError={({ file }) => {
          const key = placeholdersRef.current.get(file)
          if (!key) return
          editor.update(() => {
            const node = $getNodeByKey(key)
            node?.remove()
            placeholdersRef.current.delete(file)
          })
          setSubmitDisabled?.(false)
        }}
      >
        <AddFileIcon width={18} height={18} />
      </FileUpload>
    </div>
  )
}
