import { Form, MarkdownInput, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import { COMMENTS } from '../fragments/comments'
import { useMe } from './me'
import ActionTooltip from './action-tooltip'
import TextareaAutosize from 'react-textarea-autosize'
import { useEffect, useState } from 'react'
import Info from './info'
import Link from 'next/link'

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

export default function Reply ({ parentId, meComments, onSuccess, replyOpen }) {
  const [reply, setReply] = useState(replyOpen)
  const me = useMe()

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
            },
            ncomments (existingNComments = 0) {
              return existingNComments + 1
            },
            meComments (existingMeComments = 0) {
              return existingMeComments + 1
            }
          }
        })
      }
    }
  )

  const cost = me?.freeComments ? 0 : Math.pow(10, meComments)

  return (
    <div>
      {replyOpen
        ? <div className={styles.replyButtons} />
        : (
          <div
            className={styles.replyButtons}
            onClick={() => setReply(!reply)}
          >
            {reply ? 'cancel' : 'reply'}
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
            hint={me?.freeComments ? <span className='text-success'>{me.freeComments} free comments left</span> : null}
          />
          <div className='d-flex align-items-center mt-1'>
            <ActionTooltip overlayText={`${cost} sats`}>
              <SubmitButton variant='secondary'>reply{cost > 1 && <small> {cost} sats</small>}</SubmitButton>
            </ActionTooltip>
            {cost > 1 && (
              <Info>
                <div className='font-weight-bold'>Multiple replies on the same level get pricier, but we still love your thoughts!</div>
              </Info>
            )}
          </div>
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
