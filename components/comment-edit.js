import { Form, MarkdownInput } from '@/components/form'
import styles from './reply.module.css'
import { commentSchema } from '@/lib/validate'
import { useToast } from './toast'
import { toastUpsertSuccessMessages } from '@/lib/form'
import { FeeButtonProvider } from './fee-button'
import { ItemButtonBar } from './post'
import { UPSERT_COMMENT } from '@/fragments/paidAction'
import { usePaidMutation } from './use-paid-mutation'

export default function CommentEdit ({ comment, editThreshold, onSuccess, onCancel }) {
  const toaster = useToast()
  const [upsertComment] = usePaidMutation(UPSERT_COMMENT, {
    update (cache, { data: { upsertComment: { result } } }) {
      if (!result) return

      cache.modify({
        id: `Item:${comment.id}`,
        fields: {
          text () {
            return result.text
          }
        }
      })
    }
  })

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
            toastUpsertSuccessMessages(toaster, data, 'upsertComment', true, values.text)
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
