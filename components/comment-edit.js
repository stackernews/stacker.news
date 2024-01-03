import { Form, MarkdownInput } from '../components/form'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import { commentSchema } from '../lib/validate'
import { useToast } from './toast'
import { toastDeleteScheduled } from '../lib/form'
import { FeeButtonProvider } from './fee-button'
import { ItemButtonBar } from './post'

export default function CommentEdit ({ comment, editThreshold, onSuccess, onCancel }) {
  const toaster = useToast()
  const [upsertComment] = useMutation(
    gql`
      mutation upsertComment($id: ID! $text: String!) {
        upsertComment(id: $id, text: $text) {
          text
          deleteScheduledAt
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
      <FeeButtonProvider>
        <Form
          initial={{
            text: comment.text
          }}
          schema={commentSchema}
          onSubmit={async (values, { resetForm }) => {
            const { data, error } = await upsertComment({ variables: { ...values, id: comment.id } })
            if (error) {
              throw new Error({ message: error.toString() })
            }
            toastDeleteScheduled(toaster, data, 'upsertComment', true, values.text)
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
          <ItemButtonBar itemId={comment.id} onDelete={onSuccess} hasCancel={false} />
        </Form>
      </FeeButtonProvider>
    </div>
  )
}
