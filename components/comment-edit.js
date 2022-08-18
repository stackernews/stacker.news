import { Form, MarkdownInput, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import TextareaAutosize from 'react-textarea-autosize'
import { useState } from 'react'
import { EditFeeButton } from './fee-button'

export const CommentSchema = Yup.object({
  text: Yup.string().required('required').trim()
})

export default function CommentEdit ({ comment, editThreshold, onSuccess, onCancel }) {
  const [hasImgLink, setHasImgLink] = useState()

  const [updateComment] = useMutation(
    gql`
      mutation updateComment($id: ID! $text: String!) {
        updateComment(id: $id, text: $text) {
          text
          paidImgLink
        }
      }`, {
      update (cache, { data: { updateComment } }) {
        cache.modify({
          id: `Item:${comment.id}`,
          fields: {
            text () {
              return updateComment.text
            },
            paidImgLink () {
              return updateComment.paidImgLink
            }
          }
        })
      }
    }
  )

  return (
    <div className={`${styles.reply} mt-2`}>
      <Form
        initial={{
          text: comment.text
        }}
        schema={CommentSchema}
        onSubmit={async (values, { resetForm }) => {
          const { error } = await updateComment({ variables: { ...values, id: comment.id } })
          if (error) {
            throw new Error({ message: error.toString() })
          }
          if (onSuccess) {
            onSuccess()
          }
        }}
      >
        <MarkdownInput
          name='text'
          as={TextareaAutosize}
          minRows={6}
          autoFocus
          setHasImgLink={setHasImgLink}
          required
        />
        <EditFeeButton
          paidSats={comment.meSats} hadImgLink={comment.paidImgLink} hasImgLink={hasImgLink}
          parentId={comment.parentId} text='save' ChildButton={SubmitButton} variant='secondary'
        />
      </Form>
    </div>
  )
}
