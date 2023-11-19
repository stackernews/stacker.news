import { Form, MarkdownInput } from '../components/form'
import { gql, useMutation } from '@apollo/client'
import styles from './reply.module.css'
import { COMMENTS } from '../fragments/comments'
import { useMe } from './me'
import { forwardRef, useCallback, useEffect, useState, useRef, useImperativeHandle } from 'react'
import Link from 'next/link'
import { FeeButtonProvider, postCommentBaseLineItems, postCommentUseRemoteLineItems } from './fee-button'
import { commentsViewedAfterComment } from '../lib/new-comments'
import { commentSchema } from '../lib/validate'
import { quote } from '../lib/md'
import { COMMENT_DEPTH_LIMIT } from '../lib/constants'
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

export default forwardRef(function Reply ({ item, onSuccess, replyOpen, children, placeholder, contentContainerRef }, ref) {
  const [reply, setReply] = useState(replyOpen)
  const me = useMe()
  const parentId = item.id
  const replyInput = useRef(null)
  const formInnerRef = useRef()

  // Start block to handle iOS Safari's weird selection clearing behavior
  const savedRange = useRef()
  const savedRangeNode = useRef()
  const onTouchEnd = useCallback(() => {
    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.getRangeAt(0).length === 0) {
      return
    }
    const range = selection.getRangeAt(0)
    savedRangeNode.current = range.commonAncestorContainer
    savedRange.current = range.cloneContents()
  }, [])
  useEffect(() => {
    document.addEventListener('touchend', onTouchEnd)
    return () => document.removeEventListener('touchend', onTouchEnd)
  }, [])
  // End block to handle iOS Safari's weird selection clearing behavior

  useImperativeHandle(ref, () => ({
    quoteReply: ({ selectionOnly }) => {
      if (!reply) {
        setReply(true)
      }
      const selection = window.getSelection()
      let selectedText = selection.isCollapsed ? undefined : selection.toString()
      let isSelectedTextInTarget = contentContainerRef?.current?.contains(selection.anchorNode)

      // Start block to handle iOS Safari's weird selection clearing behavior
      if (!selectedText && savedRange.current && savedRangeNode.current) {
        selectedText = savedRange.current.textContent
        isSelectedTextInTarget = contentContainerRef?.current?.contains(savedRangeNode.current)
      }
      // End block to handle iOS Safari's weird selection clearing behavior

      if ((selection.isCollapsed || !isSelectedTextInTarget || !selectedText) && selectionOnly) return
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
              className='pe-3' onPointerDown={e => {
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
              innerRef={formInnerRef}
            >
              <MarkdownInput
                name='text'
                minRows={6}
                autoFocus={!replyOpen}
                required
                placeholder={placeholder}
                innerRef={replyInput}
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
