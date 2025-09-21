import { Form, MarkdownInput } from '@/components/form'
import styles from './reply.module.css'
import { commentSchema } from '@/lib/validate'
import { FeeButtonProvider } from './fee-button'
import { ItemButtonBar } from './post'
import { UPDATE_COMMENT } from '@/fragments/paidAction'
import useItemSubmit from './use-item-submit'
import Editor from '@/lexical/editor'

export default function CommentEdit ({ comment, editThreshold, onSuccess, onCancel }) {
  const onSubmit = useItemSubmit(UPDATE_COMMENT, {
    paidMutationOptions: {
      update (cache, { data: { upsertComment: { result } } }) {
        if (!result) return

        cache.modify({
          id: `Item:${comment.id}`,
          fields: {
            text () {
              return result.text
            },
            lexicalState () {
              return result.lexicalState
            },
            html () {
              return result.html
            }
          },
          optimistic: true
        })
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
            text: comment.text,
            lexicalState: comment.lexicalState
          }}
          schema={commentSchema}
          onSubmit={onSubmit}
        >
          {comment.lexicalState
            ? <Editor context='text' />
            : (
              <MarkdownInput
                name='text'
                minRows={6}
                autoFocus
                required
              />
              )}
          <ItemButtonBar itemId={comment.id} onDelete={onSuccess} hasCancel={false} />
        </Form>
      </FeeButtonProvider>
    </div>
  )
}
