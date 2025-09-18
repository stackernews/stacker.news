import styles from '@/components/lexical/styles/theme.module.css'
import { useRef, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_EDITOR, $insertNodes } from 'lexical'
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
        onUpload={(file) => {
          console.log('onUpload', file)
          setSubmitDisabled?.(true)
          editor.dispatchCommand(INSERT_FILES_COMMAND, [file])
        }}
        onSuccess={({ url, name }) => {
          editor.dispatchCommand(INSERT_FILES_COMMAND, [{ url, name }])
          // updateUploadFees({ variables: { s3Keys: [Number(id)] } })
          setSubmitDisabled?.(false)
        }}
        onError={() => {
          setSubmitDisabled?.(false)
        }}
      >
        <AddFileIcon width={18} height={18} />
      </FileUpload>
    </div>
  )
}
