import { useCallback, useState, useEffect, useRef } from 'react'
import ArrowUp from '../svgs/arrow-up-s-line.svg'
import ArrowDown from '../svgs/arrow-down-s-line.svg'
import styles from './comment.module.css'
import { useFavicon } from './favicon'
import { useRouter } from 'next/router'

// TODO: mega cleanup after solid decision on design pattern
export function useLiveCommentsNavigator () {
  const { hasNewComments, setHasNewComments } = useFavicon()
  const router = useRouter()
  const [commentCount, setCommentCount] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(-1)

  const commentRefs = useRef([])

  // add a new comment ref to the list
  const trackNewComment = useCallback((commentRef) => {
    if (!commentRef?.current) return

    // dedupe and store the ref
    if (!commentRefs.current.some(ref => ref.current === commentRef.current)) {
      commentRefs.current.push(commentRef)
    }

    setCommentCount(commentRefs.current.length)
  }, [])

  // clear the list of refs and reset the current index to -1
  const clearCommentRefs = useCallback(() => {
    // reset navigator
    commentRefs.current = []
    setCurrentIndex(-1)
    setCommentCount(0)

    // reset favicon
    if (hasNewComments) {
      setHasNewComments(false)
    }
  }, [hasNewComments, setHasNewComments])

  const scrollToComment = useCallback((direction) => {
    const refs = commentRefs.current

    let newIndex
    if (direction === 'prev') {
      newIndex = Math.max(currentIndex - 1, 0)
    } else if (direction === 'next') {
      newIndex = Math.min(currentIndex + 1, commentCount - 1)
    }

    setCurrentIndex(newIndex)

    const ref = refs[newIndex]
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
    if (newIndex === commentCount - 1) {
      clearCommentRefs()
    }
  }, [clearCommentRefs, currentIndex, commentCount])

  // reset navigator on route changes
  useEffect(() => {
    const clearOnRouteChange = () => {
      clearCommentRefs()
    }

    router.events.on('routeChangeStart', clearOnRouteChange)
    return () => router.events.off('routeChangeStart', clearOnRouteChange)
  }, [clearCommentRefs, router.events])

  return {
    trackNewComment,
    scrollToComment,
    clearCommentRefs,
    currentIndex,
    commentCount
  }
}

export function LiveCommentsNavigator ({ navigator }) {
  const { commentCount, currentIndex, scrollToComment, clearCommentRefs } = navigator
  if (!commentCount) return null

  console.log('commentCount', commentCount)

  return (
    <span className={`${styles.commentNavigator} fw-bold`}>
      <span>{currentIndex + 1}/{commentCount} new comment{commentCount > 1 ? 's' : ''}</span>
      {/* hover on buttons makes them more visible */}
      <div className='d-flex align-items-center justify-content-center gap-1'>
        <span
          onClick={() => scrollToComment('prev')}
          disabled={currentIndex <= 0}
          className={`${styles.navigatorButton} ${currentIndex <= 0 ? styles.disabled : ''}`}
        >
          <ArrowUp width={24} height={24} className={styles.navigatorButton} />
        </span>
        <span
          onClick={() => scrollToComment('next')}
          disabled={currentIndex === commentCount - 1}
          className={`${styles.navigatorButton} ${currentIndex === commentCount - 1 ? styles.disabled : ''}`}
        >
          <ArrowDown width={24} height={24} className={styles.navigatorButton} />
        </span>
      </div>
      <span
        aria-label='close'
        onClick={clearCommentRefs}
        className={`${styles.closeButton} p-0 px-2`}
      >
        X
      </span>
    </span>
  )
}
