import { Form, MarkdownInput, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import TextareaAutosize from 'react-textarea-autosize'
import Countdown from 'react-countdown'

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
          minRows={4}
          autoFocus
          required
          groupClassName='mb-0'
          hint={
            <span className='text-muted font-weight-bold'>
              <Countdown
                date={editThreshold}
                renderer={props => <span> {props.formatted.minutes}:{props.formatted.seconds}</span>}
              />
            </span>
            }
        />
        <div className='d-flex align-items-center justify-content-between'>
          <SubmitButton variant='secondary' className='mt-1'>save</SubmitButton>
          <div
            className='font-weight-bold text-muted mr-3'
            style={{ fontSize: '80%', cursor: 'pointer' }}
            onClick={onCancel}
          >
            cancel
          </div>
        </div>
      </Form>
    </div>
  )
}
