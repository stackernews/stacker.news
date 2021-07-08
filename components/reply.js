import { Form, MarkdownInput, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import { COMMENTS } from '../fragments/comments'
import { useMe } from './me'
import ActionTooltip from './action-tooltip'

export const CommentSchema = Yup.object({
  text: Yup.string().required('required').trim()
})

export default function Reply ({ parentId, onSuccess, autoFocus }) {
  const me = useMe()

  const [createComment] = useMutation(
    gql`
      ${COMMENTS}
      mutation createComment($text: String!, $parentId: ID!) {
        createComment(text: $text, parentId: $parentId) {
          ...CommentFields
          comments {
            ...CommentsRecursive
          }
        }
      }`, {
      update (cache, { data: { createComment } }) {
        cache.modify({
          id: `Item:${parentId}`,
          fields: {
            comments (existingCommentRefs = []) {
              const newCommentRef = cache.writeFragment({
                data: createComment,
                fragment: COMMENTS,
                fragmentName: 'CommentsRecursive'
              })
              return [newCommentRef, ...existingCommentRefs]
            },
            ncomments (existingNComments = 0) {
              return existingNComments + 1
            }
          }
        })
      }
    }
  )

  return (
    <div className={styles.reply}>
      <Form
        initial={{
          text: ''
        }}
        schema={CommentSchema}
        onSubmit={async (values, { resetForm }) => {
          const { error } = await createComment({ variables: { ...values, parentId } })
          if (error) {
            throw new Error({ message: error.toString() })
          }
          resetForm({ text: '' })
          if (onSuccess) {
            onSuccess()
          }
        }}
      >
        <MarkdownInput
          name='text'
          as='textarea'
          rows={4}
          autoFocus={autoFocus}
          required
          hint={me?.freeComments ? <span className='text-success'>{me.freeComments} free comments left</span> : null}
        />
        <ActionTooltip>
          <SubmitButton variant='secondary' className='mt-1'>reply</SubmitButton>
        </ActionTooltip>
      </Form>
    </div>
  )
}

export function ReplySkeleton () {
  return (
    <div className={`${styles.reply} ${styles.skeleton}`}>
      <div className={`${styles.input} clouds`} />
      <div className={`${styles.button} clouds`} />
    </div>
  )
}
