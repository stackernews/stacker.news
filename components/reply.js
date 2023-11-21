import { Form, MarkdownInput } from '../components/form'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import { COMMENTS } from '../fragments/comments'
import { useMe } from './me'
import { forwardRef, useCallback, useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { FeeButtonProvider, postCommentBaseLineItems, postCommentUseRemoteLineItems } from './fee-button'
import { commentsViewedAfterComment } from '../lib/new-comments'
import { commentSchema } from '../lib/validate'
import { COMMENT_DEPTH_LIMIT } from '../lib/constants'
import { useToast } from './toast'
import { toastDeleteScheduled } from '../lib/form'
import { ItemButtonBar } from './post'

export function ReplyOnAnotherPage ({ item }) {
  const path = item.path.split('.')
  const rootId = path.slice(-(COMMENT_DEPTH_LIMIT - 1))[0]

  let text = 'reply on another page'
  if (item.ncomments > 0) {
    text = 'view replies'
  }

  return (
    <Link href={`/items/${rootId}?commentId=${item.id}`} as={`/items/${rootId}`} className='d-block py-3 fw-bold text-muted'>
      {text}
    </Link>
  )
}

export default forwardRef(function Reply ({ item, onSuccess, replyOpen, children, placeholder, onQuoteReply, onCancelQuote, quote }, ref) {
  const [reply, setReply] = useState(replyOpen || quote)
  const me = useMe()
  const parentId = item.id
  const replyInput = useRef(null)
  const toaster = useToast()

  useEffect(() => {
    if (replyOpen || quote || !!window.localStorage.getItem('reply-' + parentId + '-' + 'text')) {
      setReply(true)
    }
  }, [replyOpen, quote, parentId])

  const [upsertComment] = useMutation(
    gql`
      ${COMMENTS}
      mutation upsertComment($text: String!, $parentId: ID!, $hash: String, $hmac: String) {
        upsertComment(text: $text, parentId: $parentId, hash: $hash, hmac: $hmac) {
          ...CommentFields
          deleteScheduledAt
          comments {
            ...CommentsRecursive
          }
        }
      }`, {
      update (cache, { data: { upsertComment } }) {
        cache.modify({
          id: `Item:${parentId}`,
          fields: {
            comments (existingCommentRefs = []) {
              const newCommentRef = cache.writeFragment({
                data: upsertComment,
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
        commentsViewedAfterComment(root, upsertComment.createdAt)
      }
    }
  )

  const onSubmit = useCallback(async ({ amount, hash, hmac, ...values }, { resetForm }) => {
    const { data } = await upsertComment({ variables: { parentId, hash, hmac, ...values } })
    toastDeleteScheduled(toaster, data, false, values.text)
    resetForm({ text: '' })
    setReply(replyOpen || false)
  }, [upsertComment, setReply, parentId])

  useEffect(() => {
    if (replyInput.current && reply && !replyOpen) replyInput.current.focus()
  }, [reply])

  return (
    <div>
      {replyOpen
        ? <div className={styles.replyButtons} />
        : (
          <div className={styles.replyButtons}>
            <div
              className='pe-3'
              onClick={e => {
                if (reply) {
                  window.localStorage.removeItem('reply-' + parentId + '-' + 'text')
                  setReply(false)
                  onCancelQuote?.()
                } else {
                  e.preventDefault()
                  onQuoteReply({ selectionOnly: true })
                  setReply(true)
                }
              }}
            >
              {reply ? 'cancel' : 'reply'}
            </div>
            {/* HACK if we need more items, we should probably do a comment toolbar */}
            {children}
          </div>)}
      {reply &&
        <div className={styles.reply}>
          <FeeButtonProvider
            baseLineItems={postCommentBaseLineItems({ baseCost: 1, comment: true, me: !!me })}
            useRemoteLineItems={postCommentUseRemoteLineItems({ parentId: item.id, me: !!me })}
          >
            <Form
              initial={{
                text: ''
              }}
              schema={commentSchema}
              invoiceable
              onSubmit={onSubmit}
              storageKeyPrefix={`reply-${parentId}`}
            >
              <MarkdownInput
                name='text'
                minRows={6}
                autoFocus={!replyOpen}
                required
                appendValue={quote}
                placeholder={placeholder}
              />
              <ItemButtonBar createText='reply' hasCancel={false} />
            </Form>
          </FeeButtonProvider>
        </div>}
    </div>
  )
})

export function ReplySkeleton () {
  return (
    <div className={`${styles.reply} ${styles.skeleton}`}>
      <div className={`${styles.input} clouds`} />
      <div className={`${styles.button} clouds`} />
    </div>
  )
}
