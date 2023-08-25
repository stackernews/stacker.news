import { Form, MarkdownInput, SubmitButton } from '../components/form'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import { EditFeeButton } from './fee-button'
import Button from 'react-bootstrap/Button'
import Delete from './delete'
import { commentSchema } from '../lib/validate'

export default function CommentEdit ({ comment, editThreshold, onSuccess, onCancel }) {
  const [upsertComment] = useMutation(
    gql`
      mutation upsertComment($id: ID! $text: String!) {
        upsertComment(id: $id, text: $text) {
          text
        }
      }`, {
      update (cache, { data: { upsertComment } }) {
        cache.modify({
          id: `Item:${comment.id}`,
          fields: {
            text () {
              return upsertComment.text
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
        schema={commentSchema}
        onSubmit={async (values, { resetForm }) => {
          const { error } = await upsertComment({ variables: { ...values, id: comment.id } })
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
          minRows={6}
          autoFocus
          required
        />
        <div className='d-flex justify-content-between'>
          <Delete itemId={comment.id} onDelete={onSuccess} type='comment'>
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
