import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useMe } from './me'
import { commentsViewed, commentsViewedNum } from '@/lib/new-comments'
import styles from './comment.module.css'

export function useOutline ({ ref, navigator }) {
  const setOutline = useCallback((item) => {
    if (!ref.current) return

    if (item.injected) {
      // newly injected comments (item.injected) have to use a different class to outline every new comment
      ref.current.classList.add('outline-new-injected-comment')

      // wait for the injection animation to end before removing its class
      ref.current.addEventListener('animationend', () => {
        ref.current.classList.remove(styles.injectedComment)
      }, { once: true })
      // animate the live comment injection
      ref.current.classList.add(styles.injectedComment)
    } else {
      ref.current.classList.add('outline-new-comment')
      return () => ref.current.classList.remove('outline-new-comment')
    }

    console.log('track new comment', ref.current)

    navigator.trackNewComment(ref)
  }, [ref])

  const unsetOutline = useCallback(() => {
    if (!ref.current) return

    const hasOutline = ref.current.classList.contains('outline-new-comment') ||
                      ref.current.classList.contains('outline-new-injected-comment')
    const hasOutlineUnset = ref.current.classList.contains('outline-new-comment-unset')

    if (hasOutline && !hasOutlineUnset) {
      ref.current.classList.add('outline-new-comment-unset')
      // untrack the new comment
      navigator.unTrackNewComment(ref)
    }
  }, [ref])

  return { unsetOutline, setOutline }
}

export function useItemOutline ({ ref, item, rootLastCommentAt, navigator }) {
  const router = useRouter()
  const { me } = useMe()
  const { unsetOutline, setOutline } = useOutline({ ref, navigator })

  const isNewComment = useMemo(() => {
    if (me?.id === item.user?.id) return false

    const itemCreatedAt = new Date(item.createdAt).getTime()
    // it's a new comment if it was created after the last comment was viewed
    // or, in the case of live comments, after the last comment was created
    return (router.query.commentsViewedAt && itemCreatedAt > router.query.commentsViewedAt) ||
    (rootLastCommentAt && itemCreatedAt > new Date(rootLastCommentAt).getTime())
  }, [item.id, me?.id, router.query.commentsViewedAt, rootLastCommentAt])

  useEffect(() => {
    if (isNewComment) setOutline(item)
  }, [item.id, isNewComment, setOutline])

  return { unsetOutline }
}

export function useBottomedOutline ({ ref, item, navigator }) {
  const { unsetOutline, setOutline } = useOutline({ ref, navigator })
  const [hasNewComments, setHasNewComments] = useState(false)

  const unsetBottomedOutline = useCallback(() => {
    setHasNewComments(false)
    unsetOutline()
  }, [unsetOutline, setHasNewComments])

  // set the outline if the number of comments has increased
  useEffect(() => {
    const savedNum = commentsViewedNum(item.id)
    if (item.ncomments > savedNum) {
      setOutline(item)
      setHasNewComments(true)
    }
  }, [item.ncomments, item.id, setOutline, setHasNewComments])

  // save the number of viewed comments
  useEffect(() => {
    commentsViewed(item)
  }, [item.id])

  return { hasNewComments, unsetBottomedOutline }
}
