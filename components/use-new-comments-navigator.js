import { useCallback, useEffect, useState } from 'react'
import ArrowRight from '../svgs/arrow-right-line.svg'
import styles from './comment.module.css'
import { useRouter } from 'next/router'

export function useNewCommentsNavigator () {
  const router = useRouter()
  const [commentRefs, setCommentRefs] = useState([])

  // clear the list of refs and resets favicon
  const clearCommentRefs = useCallback(() => {
    // reset navigator
    setCommentRefs([])
  }, [])

  // reset navigator on route changes
  useEffect(() => {
    const clearOnRouteChange = () => {
      clearCommentRefs()
    }

    router.events.on('routeChangeStart', clearOnRouteChange)
    return () => router.events.off('routeChangeStart', clearOnRouteChange)
  }, [clearCommentRefs, router.events])

  // add a new comment ref to the list
  const trackNewComment = useCallback((commentRef) => {
    if (!commentRef?.current) return

    // requestAnimationFrame to ensure the DOM is updated before checking if the comment is visible
    window.requestAnimationFrame(() => {
      // track this new comment if it's not visible in the viewport
      const rect = commentRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth

      const isVisible = rect.top >= 0 &&
                        rect.left >= 0 &&
                        rect.bottom <= viewportHeight &&
                        rect.right <= viewportWidth

      if (isVisible) return

      // dedupe and store the ref
      setCommentRefs(prev => (
        prev.some(ref => ref.current === commentRef.current) ? prev : [...prev, commentRef]
      ))
    })
  }, [])

  // remove a comment ref from the list
  const unTrackNewComment = useCallback((commentRef) => {
    // no need to untrack if there are no new comments
    if (!commentRef?.current) return

    // remove the ref from the list
    setCommentRefs(prev => prev.filter(ref => ref.current !== commentRef.current))
  }, [])

  const scrollToComment = useCallback(() => {
    if (commentRefs.length === 0) return

    const ref = commentRefs[0]
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

    // when the animation ends, remove the temporary outline and add the unset class: we viewed the comment
    ref.current.addEventListener('animationend', clearOutline, { once: true })

    // requestAnimationFrame to ensure the removal is processed before adding
    window.requestAnimationFrame(() => {
      ref.current.classList.add('outline-it')
    })

    // we reached the end of the new comments, clear the tracked refs
    if (commentRefs.length === 1) {
      clearCommentRefs()
    } else {
      unTrackNewComment(ref)
    }
  }, [commentRefs, clearCommentRefs, unTrackNewComment])

  return {
    trackNewComment,
    unTrackNewComment,
    scrollToComment,
    clearCommentRefs,
    commentCount: commentRefs.length
  }
}

export function NewCommentsNavigator ({ navigator }) {
  const { commentCount, scrollToComment, clearCommentRefs } = navigator
  if (!commentCount) return null

  return (
    <span className={`${styles.commentNavigator} fw-bold`}>
      <span>{commentCount} new comment{commentCount > 1 ? 's' : ''}</span>
      <span
        onClick={() => scrollToComment()}
        className={`${styles.navigatorButton}`}
      >
        <ArrowRight width={24} height={24} className={styles.navigatorButton} />
      </span>
      <span
        aria-label='close'
        onClick={clearCommentRefs}
        className={`${styles.closeButton}`}
      >
        X
      </span>
    </span>
  )
}
