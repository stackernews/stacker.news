import { useCallback, useEffect, useRef, useState, startTransition, createContext, useContext } from 'react'
import styles from './comment.module.css'
import { useRouter } from 'next/router'
import LongPressable from './long-pressable'

const CommentsNavigatorContext = createContext({
  navigator: {
    trackNewComment: () => {},
    untrackNewComment: () => {},
    scrollToComment: () => {},
    clearCommentRefs: () => {}
  },
  commentCount: 0
})

export function CommentsNavigatorProvider ({ children }) {
  const value = useCommentsNavigator()
  return (
    <CommentsNavigatorContext.Provider value={value}>
      {children}
    </CommentsNavigatorContext.Provider>
  )
}

export function useCommentsNavigatorContext () {
  return useContext(CommentsNavigatorContext)
}

export function useCommentsNavigator () {
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
  const trackNewComment = useCallback((commentRef, createdAt) => {
    try {
      window.requestAnimationFrame(() => {
        if (!commentRef?.current || !commentRef.current.isConnected) return

        // don't track this new comment if it's visible in the viewport
        const rect = commentRef.current.getBoundingClientRect()
        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight
        if (isVisible) return

        // dedupe and store the ref
        const existingIndex = commentRefsRef.current.findIndex(item => item.ref.current === commentRef.current)
        if (existingIndex === -1) {
          // find the correct insertion position to maintain sort order
          const insertIndex = commentRefsRef.current.findIndex(item => item.createdAt > createdAt)
          const newItem = { ref: commentRef, createdAt }

          if (insertIndex === -1) {
            // append if no newer comments found
            commentRefsRef.current.push(newItem)
          } else {
            // insert at the correct position to maintain sort order
            commentRefsRef.current.splice(insertIndex, 0, newItem)
          }

          setCountThrottled()
        }
      })
    } catch {
      // in the rare case of a ref being disconnected during RAF, ignore to avoid blocking UI
    }
  }, [setCountThrottled])

  // remove a comment ref from the list
  const untrackNewComment = useCallback((commentRef, options = {}) => {
    const { includeDescendants = false, clearOutline = false } = options
    if (!commentRef?.current) return
    const refNode = commentRef.current
    const before = commentRefsRef.current.length

    const toRemove = commentRefsRef.current.filter(item => {
      const node = item?.ref?.current
      return includeDescendants
        ? node && refNode.contains(node)
        : node === refNode
    })

    if (clearOutline) {
      for (const item of toRemove) {
        const ref = item.ref.current
        if (!ref) continue
        ref.classList.remove(
          'outline-it',
          'outline-new-comment',
          'outline-new-injected-comment'
        )
        ref.classList.add('outline-new-comment-unset')
      }
    }

    commentRefsRef.current = commentRefsRef.current.filter(item => !toRemove.includes(item))

    // update the comment count if the list actually changed
    if (commentRefsRef.current.length !== before) setCountThrottled()
  }, [setCountThrottled])

  // scroll to the next new comment
  const scrollToComment = useCallback(() => {
    const list = commentRefsRef.current
    if (!list.length) return
    const ref = list[0].ref
    if (!ref?.current) return

    // smoothly scroll to the start of the comment
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })

    // clear the outline class after the animation ends
    ref.current.addEventListener('animationend', () => {
      ref.current.classList.remove('outline-it')
    }, { once: true })

    // requestAnimationFrame to ensure untracking is processed before outlining
    window.requestAnimationFrame(() => {
      ref.current.classList.add('outline-it')
    })

    // we reached the end of the new comments, clear the tracked refs
    if (list.length === 1) {
      clearCommentRefs()
    } else {
      untrackNewComment(ref, { includeDescendants: true, clearOutline: true })
    }
  }, [clearCommentRefs, untrackNewComment])

  // create the navigator object once
  if (!navigatorRef.current) {
    navigatorRef.current = { trackNewComment, untrackNewComment, scrollToComment, clearCommentRefs }
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

export function CommentsNavigator ({ navigator, commentCount }) {
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
    if (!commentCount) return
    document.addEventListener('keydown', onNext)
    return () => document.removeEventListener('keydown', onNext)
  }, [onNext])

  if (!commentCount) return null

  return (
    <LongPressable onShortPress={scrollToComment} onLongPress={clearCommentRefs}>
      <aside className={`${styles.commentNavigator} fw-bold`}>
        <span aria-label='next comment' className={styles.navigatorButton}>
          <div className={styles.newCommentDot} />
        </span>
        <span className='text-muted'>{commentCount}</span>
      </aside>
    </LongPressable>
  )
}
