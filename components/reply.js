import { Form, MarkdownInput } from '@/components/form'
import styles from './reply.module.css'
import { COMMENTS } from '@/fragments/comments'
import { useMe } from './me'
import { forwardRef, useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { FeeButtonProvider, postCommentBaseLineItems, postCommentUseRemoteLineItems } from './fee-button'
import { commentsViewedAfterComment } from '@/lib/new-comments'
import { commentSchema } from '@/lib/validate'
import { ItemButtonBar } from './post'
import { useShowModal } from './modal'
import { Button } from 'react-bootstrap'
import { useRoot } from './root'
import { CREATE_COMMENT } from '@/fragments/paidAction'
import useItemSubmit from './use-item-submit'
import gql from 'graphql-tag'

export default forwardRef(function Reply ({
  item,
  replyOpen,
  children,
  onQuoteReply,
  onCancelQuote,
  quote
}, ref) {
  const [reply, setReply] = useState(replyOpen || quote)
  const { me } = useMe()
  const parentId = item.id
  const replyInput = useRef(null)
  const showModal = useShowModal()
  const root = useRoot()
  const sub = item?.sub || root?.sub

  useEffect(() => {
    if (replyOpen || quote || !!window.localStorage.getItem('reply-' + parentId + '-' + 'text')) {
      setReply(true)
    }
  }, [replyOpen, quote, parentId])

  const placeholder = useMemo(() => {
    return [
      'comment for currency',
      'fractions of a penny for your thoughts?',
      'put your money where your mouth is'
    ][parentId % 3]
  }, [parentId])

  const onSubmit = useItemSubmit(CREATE_COMMENT, {
    extraValues: { parentId },
    paidMutationOptions: {
      update (cache, { data: { upsertComment: { result, invoice } } }) {
        if (!result) return

        cache.modify({
          id: `Item:${parentId}`,
          fields: {
            comments (existingComments = {}) {
              const newCommentRef = cache.writeFragment({
                data: result,
                fragment: COMMENTS,
                fragmentName: 'CommentsRecursive'
              })
              return {
                cursor: existingComments.cursor,
                comments: [newCommentRef, ...(existingComments?.comments || [])]
              }
            }
          },
          optimistic: true
        })

        // no lag for itemRepetition
        if (!item.mine && me) {
          cache.updateQuery({
            query: gql`{ itemRepetition(parentId: "${parentId}") }`
          }, data => {
            return {
              itemRepetition: (data?.itemRepetition || 0) + 1
            }
          })
        }

        const ancestors = item.path.split('.')

        // update all ancestors
        ancestors.forEach(id => {
          cache.modify({
            id: `Item:${id}`,
            fields: {
              ncomments (existingNComments = 0) {
                return existingNComments + 1
              }
            },
            optimistic: true
          })
        })

        // so that we don't see indicator for our own comments, we record this comments as the latest time
        // but we also have record num comments, in case someone else commented when we did
        const root = ancestors[0]
        commentsViewedAfterComment(root, result.createdAt)
      }
    },
    onSuccessfulSubmit: (data, { resetForm }) => {
      resetForm({ values: { text: '' } })
      setReply(replyOpen || false)
    },
    navigateOnSubmit: false
  })

  useEffect(() => {
    if (replyInput.current && reply && !replyOpen) replyInput.current.focus()
  }, [reply])

  const onCancel = useCallback(() => {
    window.localStorage.removeItem('reply-' + parentId + '-' + 'text')
    setReply(false)
    onCancelQuote?.()
  }, [setReply, parentId, onCancelQuote])

  return (
    <div>
      {replyOpen
        ? <div className='p-3' />
        : (
          <div className={styles.replyButtons}>
            <div
              className='pe-3'
              onClick={e => {
                if (reply) {
                  const text = window.localStorage.getItem('reply-' + parentId + '-' + 'text')
                  if (text?.trim()) {
                    showModal(onClose => (
                      <>
                        <p className='fw-bolder'>Are you sure? You will lose your work</p>
                        <div className='d-flex justify-content-end'>
                          <Button
                            variant='info' onClick={() => {
                              onCancel()
                              onClose()
                            }}
                          >yep
                          </Button>
                        </div>
                      </>
                    ))
                  } else {
                    onCancel()
                  }
                } else {
                  e.preventDefault()
                  onQuoteReply?.({ selectionOnly: true })
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
            baseLineItems={postCommentBaseLineItems({ baseCost: sub?.replyCost ?? 1, comment: true, me: !!me })}
            useRemoteLineItems={postCommentUseRemoteLineItems({ parentId: item.id, me: !!me })}
          >
            <Form
              initial={{
                text: ''
              }}
              schema={commentSchema}
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
                hint={sub?.moderated && 'this territory is moderated'}
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
