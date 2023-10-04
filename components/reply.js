import { Form, MarkdownInput, SubmitButton } from '../components/form'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import { COMMENTS } from '../fragments/comments'
import { useMe } from './me'
import { forwardRef, useCallback, useEffect, useState, useRef, useImperativeHandle } from 'react'
import Link from 'next/link'
import FeeButton from './fee-button'
import { commentsViewedAfterComment } from '../lib/new-comments'
import { commentSchema } from '../lib/validate'
import Info from './info'
import { quote } from '../lib/md'

export function ReplyOnAnotherPage ({ parentId }) {
  return (
    <Link href={`/items/${parentId}`} className={`${styles.replyButtons} text-muted`}>
      reply on another page
    </Link>
  )
}

function FreebieDialog () {
  return (
    <div className='text-muted'>
      you have no sats, so this one is on us
      <Info>
        <ul className='fw-bold'>
          <li>Free comments have limited visibility and are listed at the bottom of the comment section until other stackers zap them.</li>
          <li>Free comments will not cover comments that cost more than 1 sat.</li>
          <li>To get fully visibile and unrestricted comments right away, fund your account with a few sats or earn some on Stacker News.</li>
        </ul>
      </Info>
    </div>
  )
}

export default forwardRef(function Reply ({ item, onSuccess, replyOpen, children, placeholder, contentContainerRef }, ref) {
  const [reply, setReply] = useState(replyOpen)
  const me = useMe()
  const parentId = item.id
  const replyInput = useRef(null)
  const formInnerRef = useRef()
  useImperativeHandle(ref, () => ({
    quoteReply: ({ selectionOnly }) => {
      if (!reply) {
        setReply(true)
      }
      const selection = window.getSelection()
      const selectedText = selection.isCollapsed ? undefined : selection.toString()
      const isSelectedTextInTarget = contentContainerRef?.current?.contains(selection.anchorNode)
      if ((selection.isCollapsed || !isSelectedTextInTarget) && selectionOnly) return
      const textToQuote = isSelectedTextInTarget ? selectedText : item.text
      let updatedValue
      if (formInnerRef.current && formInnerRef.current.values && !formInnerRef.current.values.text) {
        updatedValue = quote(textToQuote)
      } else if (formInnerRef.current?.values?.text) {
        // append quote reply text if the input already has content
        updatedValue = `${replyInput.current.value}\n${quote(textToQuote)}`
      }
      if (updatedValue) {
        replyInput.current.value = updatedValue
        formInnerRef.current.setValues({ text: updatedValue })
        window.localStorage.setItem(`reply-${parentId}-text`, updatedValue)
      }
    }
  }), [reply, item])

  useEffect(() => {
    setReply(replyOpen || !!window.localStorage.getItem('reply-' + parentId + '-' + 'text'))
  }, [])

  const [upsertComment] = useMutation(
    gql`
      ${COMMENTS}
      mutation upsertComment($text: String!, $parentId: ID!, $hash: String, $hmac: String) {
        upsertComment(text: $text, parentId: $parentId, hash: $hash, hmac: $hmac) {
          ...CommentFields
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
    await upsertComment({ variables: { parentId, hash, hmac, ...values } })
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
              onPointerDown={e => {
                if (!reply) {
                  e.preventDefault()
                  ref?.current?.quoteReply({ selectionOnly: true })
                }
                setReply(!reply)
              }}
            >
              {reply ? 'cancel' : 'reply'}
            </div>
            {/* HACK if we need more items, we should probably do a comment toolbar */}
            {children}
          </div>)}
      <div className={styles.reply} style={{ display: reply ? 'block' : 'none' }}>
        <Form
          initial={{
            text: ''
          }}
          schema={commentSchema}
          invoiceable
          onSubmit={onSubmit}
          storageKeyPrefix={`reply-${parentId}`}
          innerRef={formInnerRef}
        >
          <MarkdownInput
            name='text'
            minRows={6}
            autoFocus={!replyOpen}
            required
            placeholder={placeholder}
            hint={me?.sats < 1 && <FreebieDialog />}
            innerRef={replyInput}
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
})

export function ReplySkeleton () {
  return (
    <div className={`${styles.reply} ${styles.skeleton}`}>
      <div className={`${styles.input} clouds`} />
      <div className={`${styles.button} clouds`} />
    </div>
  )
}
