import { Form, Input, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import { COMMENTS } from '../fragments'

export const CommentSchema = Yup.object({
  text: Yup.string().required('required').trim()
})

export default function Reply ({ item }) {
  const parentId = item.id
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
          id: `Item:${item.id}`,
          fields: {
            comments (existingCommentRefs = [], { readField }) {
              const newCommentRef = cache.writeFragment({
                data: createComment,
                fragment: COMMENTS,
                fragmentName: 'CommentsRecursive'
              })
              return [newCommentRef, ...existingCommentRefs]
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
        onSubmit={async (values) => {
          const {
            data: {
              createComment: { id }
            },
            error
          } = await createComment({ variables: { ...values, parentId } })
          if (error) {
            throw new Error({ message: error.toString() })
          }
          console.log('success!', id)
        }}
      >
        <Input
          name='text'
          as='textarea'
          rows={4}
          required
        />
        <SubmitButton variant='secondary' className='mt-1'>reply</SubmitButton>
      </Form>
    </div>
  )
}
