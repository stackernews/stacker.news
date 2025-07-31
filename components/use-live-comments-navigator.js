import { useCallback, useState, useEffect } from 'react'
import ArrowUp from '../svgs/arrow-up-s-line.svg'
import ArrowDown from '../svgs/arrow-down-s-line.svg'
import styles from './comment.module.css'

// TODO: mega cleanup after solid decision on design pattern
export function useLiveCommentsNavigator () {
  const [commentRefs, setCommentRefs] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)

  // add a new comment ref to the list
  const trackNewComment = useCallback((commentRef) => {
    if (!commentRef?.current) return

    // dedupe and store the ref
    setCommentRefs(prevRefs => {
      if (prevRefs.some(ref => ref.current === commentRef.current)) return prevRefs
      const newRefs = [...prevRefs, commentRef]
      return newRefs
    })
  }, [])

  // clear the list of refs and reset the current index to -1
  const clearCommentRefs = useCallback(() => {
    setCurrentIndex(-1)
    setCommentRefs([])
  }, [])

  const scrollToComment = useCallback((direction) => {
    let index = currentIndex
    if (direction === 'prev') {
      index = Math.max(index - 1, 0)
    } else if (direction === 'next') {
      index = Math.min(index + 1, commentRefs.length - 1)
    }

    setCurrentIndex(index)

    const ref = commentRefs[index]
    if (!ref) return
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })

    // clear any conflicting classes
    ref.current.classList.remove('outline-it', 'outline-new-comment', 'outline-new-injected-comment', 'outline-new-comment-unset')

    // when the animation ends, remove the temporary outline and add the unset class: we viewed the comment
    ref.current.addEventListener('animationend', () => {
      ref.current.classList.remove('outline-it')
      ref.current.classList.add('outline-new-comment-unset')
    }, { once: true })

    // requestAnimationFrame to ensure the removal is processed before adding
    window.requestAnimationFrame(() => {
      ref.current.classList.add('outline-it')
    })

    // we reached the end of the new comments, clear the tracked refs
    if (index === commentRefs.length - 1) {
      clearCommentRefs()
    }
  }, [commentRefs, clearCommentRefs, currentIndex])

  // clear the refs when the component unmounts
  useEffect(() => {
    return () => {
      clearCommentRefs()
    }
  }, [])

  return {
    trackNewComment,
    scrollToComment,
    clearCommentRefs,
    currentIndex,
    commentCount: commentRefs.length
  }
}

export function LiveCommentsNavigator ({ navigator }) {
  const { commentCount, currentIndex, scrollToComment, clearCommentRefs } = navigator
  if (!commentCount) return null

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
