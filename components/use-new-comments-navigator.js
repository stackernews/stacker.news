import { useCallback, useEffect, useRef, useState, startTransition } from 'react'
import ArrowRight from '../svgs/arrow-right-line.svg'
import styles from './comment.module.css'
import { useRouter } from 'next/router'

export function useNewCommentsNavigator () {
  const router = useRouter()
  const [commentCount, setCommentCount] = useState(0)
  const commentRefsRef = useRef([])
  const frameRef = useRef(null)
  const navigatorRef = useRef(null)

  // batch updates to the comment count
  const setCountThrottled = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = true
    window.requestAnimationFrame(() => {
      const next = commentRefsRef.current.length
      // transition to the new comment count
      startTransition?.(() => setCommentCount(next))
      frameRef.current = false
    })
  }, [])

  // clear the list of refs and reset the comment count
  const clearCommentRefs = useCallback(() => {
    commentRefsRef.current = []
    startTransition?.(() => setCommentCount(0))
  }, [])

  // track a new comment
  const trackNewComment = useCallback((commentRef) => {
    try {
      window.requestAnimationFrame(() => {
        if (!commentRef?.current || !commentRef.current.isConnected) return

        // don't track this new comment if it's visible in the viewport
        const rect = commentRef.current.getBoundingClientRect()
        const vh = window.innerHeight || document.documentElement.clientHeight
        const vw = window.innerWidth || document.documentElement.clientWidth
        const isVisible = rect.top >= 0 && rect.left >= 0 && rect.bottom <= vh && rect.right <= vw
        if (isVisible) return

        // dedupe and store the ref
        const exists = commentRefsRef.current.some(ref => ref.current === commentRef.current)
        if (!exists) {
          commentRefsRef.current = [...commentRefsRef.current, commentRef]
          setCountThrottled()
        }
      })
    } catch {
      // in the rare case of a ref being disconnected during RAF, ignore to avoid blocking UI
    }
  }, [setCountThrottled])

  // remove a comment ref from the list
  const unTrackNewComment = useCallback((commentRef) => {
    if (!commentRef?.current) return
    const before = commentRefsRef.current.length
    commentRefsRef.current = commentRefsRef.current.filter(ref => ref.current !== commentRef.current)
    // update the comment count if the list actually changed
    if (commentRefsRef.current.length !== before) setCountThrottled()
  }, [setCountThrottled])

  // scroll to the next new comment
  const scrollToComment = useCallback(() => {
    const list = commentRefsRef.current
    if (!list.length) return
    const ref = list[0]
    if (!ref?.current) return

    // clear any conflicting classes
    ref.current.classList.remove(
      'outline-it',
      'outline-new-comment',
      'outline-new-injected-comment',
      'outline-new-comment-unset'
    )

    // smoothly scroll to the start of the comment
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })

    const clearOutline = () => {
      ref.current.classList.remove('outline-it')
      ref.current.classList.add('outline-new-comment-unset')
    }
    ref.current.addEventListener('animationend', clearOutline, { once: true })

    // requestAnimationFrame to ensure the removal is processed before adding
    window.requestAnimationFrame(() => {
      ref.current.classList.add('outline-it')
    })

    // we reached the end of the new comments, clear the tracked refs
    if (list.length === 1) {
      clearCommentRefs()
    } else {
      unTrackNewComment(ref)
    }
  }, [clearCommentRefs, unTrackNewComment])

  // create the navigator object once
  if (!navigatorRef.current) {
    navigatorRef.current = { trackNewComment, unTrackNewComment, scrollToComment, clearCommentRefs }
  }

  // clear the navigator on route changes
  useEffect(() => {
    const clearOnRouteChange = () => {
      clearCommentRefs()
    }

    router.events.on('routeChangeStart', clearOnRouteChange)
    return () => router.events.off('routeChangeStart', clearOnRouteChange)
  }, [clearCommentRefs, router.events])

  return { navigator: navigatorRef.current, commentCount }
}

export function NewCommentsNavigator ({ navigator, commentCount }) {
  const { scrollToComment, clearCommentRefs } = navigator

  const onNext = useCallback((e) => {
    // ignore if there are no new comments or if we're focused on a textarea or input
    if (!commentCount || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
    // arrow right key scrolls to the next new comment
    if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      scrollToComment()
    }
    // escape key clears the new comments navigator
    if (e.key === 'Escape') clearCommentRefs()
  }, [commentCount, scrollToComment, clearCommentRefs])

  useEffect(() => {
    document.addEventListener('keydown', onNext)
    return () => document.removeEventListener('keydown', onNext)
  }, [onNext])

  if (!commentCount) return null

  return (
    <span className={`${styles.commentNavigator} fw-bold`}>
      <span>{commentCount} new comment{commentCount > 1 ? 's' : ''}</span>
      <span onClick={() => scrollToComment()} className={`${styles.navigatorButton}`}>
        <ArrowRight width={24} height={24} className={styles.navigatorButton} />
      </span>
      <span aria-label='close' onClick={clearCommentRefs} className={`${styles.closeButton}`}>
        X
      </span>
    </span>
  )
}
