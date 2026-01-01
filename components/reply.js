import { Form, SNInput } from '@/components/form'
import styles from './reply.module.css'
import { useMe } from './me'
import { forwardRef, useCallback, useEffect, useState, useMemo } from 'react'
import { FeeButtonProvider, postCommentBaseLineItems, postCommentUseRemoteLineItems } from './fee-button'
import { commentSchema } from '@/lib/validate'
import { ItemButtonBar } from './post'
import { useShowModal } from './modal'
import { Button } from 'react-bootstrap'
import { useRoot } from './root'
import { CREATE_COMMENT } from '@/fragments/payIn'
import { injectComment } from '@/lib/comments'
import useItemSubmit from './use-item-submit'
import gql from 'graphql-tag'
import useCommentsView from './use-comments-view'
import { MAX_COMMENT_TEXT_LENGTH } from '@/lib/constants'
import { $initializeEditorState } from '@/lib/lexical/utils'
import useCallbackRef from './use-callback-ref'

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
  const { ref: replyEditorRef, onRef: onReplyEditorRef } = useCallbackRef()
  const showModal = useShowModal()
  const root = useRoot()
  const subs = item?.subs || root.subs || []
  const { markCommentViewedAt } = useCommentsView(root.id)

  useEffect(() => {
    if (replyOpen || quote || !!window.localStorage.getItem('reply-' + parentId + '-' + 'text')) {
      setReply(true)
    }
  }, [replyOpen, quote, parentId])

  const placeholder = useMemo(() => {
    return [
      'comment for currency',
      'fractions of a penny for your thoughts?',
      'put your money where your mouth is',
      'speak now and forever hold your keys'
    ][parentId % 4]
  }, [parentId])

  const onSubmit = useItemSubmit(CREATE_COMMENT, {
    extraValues: { parentId },
    payInMutationOptions: {
      update (cache, { data: { upsertComment: { payerPrivates: { result } } } }) {
        if (!result) return

        // inject the new comment into the cache
        const injected = injectComment(cache, result)
        if (injected) {
          markCommentViewedAt(result.createdAt, { ncomments: 1 })
        }

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
      }
    },
    onSuccessfulSubmit: (data, { resetForm }) => {
      const text = ''
      resetForm({ values: { text } })
      // reset the Lexical editor state
      if (replyEditorRef) {
        replyEditorRef.update(() => {
          $initializeEditorState(text)
        })
      }
      setReply(replyOpen || false)
    },
    navigateOnSubmit: false
  })

  const onCancel = useCallback(() => {
    // clear editor
    if (replyEditorRef) {
      replyEditorRef.update(() => {
        $initializeEditorState('')
      })
    }

    window.localStorage.removeItem('reply-' + parentId + '-' + 'text')
    setReply(false)
    onCancelQuote?.()
  }, [setReply, parentId, onCancelQuote, replyEditorRef])

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
            baseLineItems={subs.length ? postCommentBaseLineItems({ subs, comment: true, me: !!me }) : undefined}
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
              <SNInput
                name='text'
                autoFocus={reply && !replyOpen}
                required
                minRows={6}
                appendValue={quote}
                lengthOptions={{ maxLength: MAX_COMMENT_TEXT_LENGTH }}
                placeholder={placeholder}
                hint={subs.some(s => s.moderated) ? 'some territories are moderated' : undefined}
                editorRef={onReplyEditorRef}
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
