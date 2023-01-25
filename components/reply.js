import { Form, MarkdownInput, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import { COMMENTS } from '../fragments/comments'
import { useMe } from './me'
import TextareaAutosize from 'react-textarea-autosize'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import FeeButton from './fee-button'
import { commentsViewedAfterComment } from '../lib/new-comments'

export const CommentSchema = Yup.object({
  text: Yup.string().required('required').trim()
})

export function ReplyOnAnotherPage ({ parentId }) {
  return (
    <Link href={`/items/${parentId}`}>
      <a className={`${styles.replyButtons} text-muted`}>reply on another page</a>
    </Link>
  )
}

export default function Reply ({ item, onSuccess, replyOpen, children }) {
  const [reply, setReply] = useState(replyOpen)
  const me = useMe()
  const parentId = item.id

  useEffect(() => {
    setReply(replyOpen || !!localStorage.getItem('reply-' + parentId + '-' + 'text'))
  }, [])

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
            }
          }
        })

        const ancestors = item.path.split('.')

        // update all ancestors
        ancestors.forEach(id => {
          cache.modify({
            id: `Item:${id}`,
            fields: {
              ncomments (existingNComments = 0) {
                return existingNComments + 1
              }
            }
          })
        })

        // so that we don't see indicator for our own comments, we record this comments as the latest time
        // but we also have record num comments, in case someone else commented when we did
        const root = ancestors[0]
        commentsViewedAfterComment(root, createComment.createdAt)
      }
    }
  )

  return (
    <div>
      {replyOpen
        ? <div className={styles.replyButtons} />
        : (
          <div className={styles.replyButtons}>
            <div
              onClick={() => setReply(!reply)}
            >
              {reply ? 'cancel' : 'reply'}
            </div>
            {/* HACK if we need more items, we should probably do a comment toolbar */}
            {children}
          </div>)}
      <div className={reply ? `${styles.reply}` : 'd-none'}>
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
            setReply(replyOpen || false)
          }}
          storageKeyPrefix={'reply-' + parentId}
        >
          <MarkdownInput
            name='text'
            as={TextareaAutosize}
            minRows={6}
            autoFocus={!replyOpen}
            required
            hint={me?.freeComments && me?.sats < 1 ? <span className='text-success'>{me.freeComments} free comments left</span> : null}
          />
          {reply &&
            <div className='mt-1'>
              <FeeButton
                baseFee={1} parentId={parentId} text='reply'
                ChildButton={SubmitButton} variant='secondary' alwaysShow
              />
            </div>}
        </Form>
      </div>
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
