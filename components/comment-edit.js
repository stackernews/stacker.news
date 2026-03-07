import { Form, SNInput } from '@/components/form'
import styles from './reply.module.css'
import { commentSchema } from '@/lib/validate'
import { FeeButtonProvider } from './fee-button'
import { ItemButtonBar } from './post'
import { UPDATE_COMMENT } from '@/fragments/payIn'
import useItemSubmit from './use-item-submit'

export default function CommentEdit ({ comment, editThreshold, onSuccess, onCancel }) {
  const onSubmit = useItemSubmit(UPDATE_COMMENT, {
    payInMutationOptions: {
      cachePhases: {
        onMutationResult (cache, { data: { upsertComment: { payerPrivates } } }) {
          const result = payerPrivates.result
          if (!result) return

          cache.modify({
            id: `Item:${comment.id}`,
            fields: {
              text () {
                return result.text
              }
            },
            optimistic: true
          })

          // propagate additional cost to ancestors if cost increased
          const costDelta = (result.cost || 0) - (comment.cost || 0)
          if (costDelta > 0 && comment.parentId && result.path) {
            const ancestors = result.path.split('.').slice(0, -1)
            ancestors.forEach(id => {
              cache.modify({
                id: `Item:${id}`,
                fields: {
                  commentCost (existingCommentCost = 0) {
                    return existingCommentCost + costDelta
                  }
                },
                optimistic: true
              })
            })
          }
        }
      }
    },
    item: comment,
    navigateOnSubmit: false,
    onSuccessfulSubmit: onSuccess
  })

  return (
    <div className={`${styles.reply} mt-2`}>
      <FeeButtonProvider>
        <Form
          initial={{
            text: comment.text
          }}
          schema={commentSchema}
          onSubmit={onSubmit}
        >
          <SNInput
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
