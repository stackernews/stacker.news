import { Form } from '@/components/form'
import styles from './reply.module.css'
import { commentSchema } from '@/lib/validate'
import { FeeButtonProvider } from './fee-button'
import { ItemButtonBar } from './post'
import { UPDATE_COMMENT } from '@/fragments/payIn'
import useItemSubmit from './use-item-submit'
import { useRef } from 'react'
import { SNMDXEditor } from './mdx'

export default function CommentEdit ({ comment, editThreshold, onSuccess, onCancel }) {
  const editorRef = useRef(null)
  const onSubmit = useItemSubmit(UPDATE_COMMENT, {
    payInMutationOptions: {
      update (cache, { data: { upsertComment: { payerPrivates } } }) {
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
          <SNMDXEditor
            name='text'
            ref={editorRef}
            autoFocus
            isEdit
          />
          <ItemButtonBar itemId={comment.id} onDelete={onSuccess} hasCancel={false} />
        </Form>
      </FeeButtonProvider>
    </div>
  )
}
