import { Form, MarkdownInput, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import TextareaAutosize from 'react-textarea-autosize'
import { EditFeeButton } from './fee-button'
import { Button } from 'react-bootstrap'
import Delete from './delete'

export const CommentSchema = Yup.object({
  text: Yup.string().required('required').trim()
})

export default function CommentEdit ({ comment, editThreshold, onSuccess, onCancel }) {
  const [updateComment] = useMutation(
    gql`
      mutation updateComment($id: ID! $text: String!) {
        updateComment(id: $id, text: $text) {
          text
        }
      }`, {
      update (cache, { data: { updateComment } }) {
        cache.modify({
          id: `Item:${comment.id}`,
          fields: {
            text () {
              return updateComment.text
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
          required
        />
        <div className='d-flex justify-content-between'>
          <Delete itemId={comment.id} onDelete={onSuccess}>
            <Button variant='grey-medium'>delete</Button>
          </Delete>
          <EditFeeButton
            paidSats={comment.meSats}
            parentId={comment.parentId} text='save' ChildButton={SubmitButton} variant='secondary'
          />
        </div>
      </Form>
    </div>
  )
}
