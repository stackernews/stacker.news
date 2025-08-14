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
  // refs in ref to not re-render on tracking
  const commentRefs = useRef([])
  // ref to track if the comment count is being updated
  const frameRef = useRef(null)
  const navigatorRef = useRef(null)

  // batch updates to the comment count
  const throttleCountUpdate = useCallback(() => {
    if (frameRef.current) return
    // prevent multiple updates in the same frame
    frameRef.current = true
    window.requestAnimationFrame(() => {
      const next = commentRefs.current.length
      // transition to the new comment count
      startTransition?.(() => setCommentCount(next))
      frameRef.current = false
    })
  }, [])

  // clear the list of refs and reset the comment count
  const clearCommentRefs = useCallback(() => {
    commentRefs.current = []
    startTransition?.(() => setCommentCount(0))
  }, [])

  // track a new comment
  const trackNewComment = useCallback((commentRef, createdAt) => {
    try {
      window.requestAnimationFrame(() => {
        if (!commentRef?.current || !commentRef.current.isConnected) return

        // don't track this new comment if it's visible in the viewport
        const rect = commentRef.current.getBoundingClientRect()
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) return

        // dedupe
        const existing = commentRefs.current.some(item => item.ref.current === commentRef.current)
        if (existing) return

        // find the correct insertion position to maintain sort order
        const insertIndex = commentRefs.current.findIndex(item => item.createdAt > createdAt)
        const newItem = { ref: commentRef, createdAt }

        if (insertIndex === -1) {
          // append if no newer comments found
          commentRefs.current.push(newItem)
        } else {
          // insert at the correct position to maintain sort order
          commentRefs.current.splice(insertIndex, 0, newItem)
        }

        throttleCountUpdate()
      })
    } catch {
      // in the rare case of a ref being disconnected during RAF, ignore to avoid blocking UI
    }
  }, [throttleCountUpdate])

  // remove a comment ref from the list
  const untrackNewComment = useCallback((commentRef, options = {}) => {
    const { includeDescendants = false, clearOutline = false } = options

    const refNode = commentRef.current
    if (!refNode) return

    const toRemove = commentRefs.current.filter(item => {
      const node = item?.ref?.current
      return includeDescendants
        ? node && refNode.contains(node)
        : node === refNode
    })

    if (clearOutline) {
      for (const item of toRemove) {
        const node = item.ref.current
        if (!node) continue
        node.classList.remove(
          'outline-it',
          'outline-new-comment',
          'outline-new-injected-comment'
        )
        node.classList.add('outline-new-comment-unset')
      }
    }

    if (toRemove.length) {
      commentRefs.current = commentRefs.current.filter(item => !toRemove.includes(item))
      throttleCountUpdate()
    }
  }, [throttleCountUpdate])

  // scroll to the next new comment
  const scrollToComment = useCallback(() => {
    const list = commentRefs.current
    if (!list.length) return

    const ref = list[0]?.ref
    const node = ref?.current
    if (!node) return

    // smoothly scroll to the start of the comment
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // clear the outline class after the animation ends
    node.addEventListener('animationend', () => {
      node.classList.remove('outline-it')
    }, { once: true })

    // requestAnimationFrame to ensure untracking is processed before outlining
    window.requestAnimationFrame(() => {
      node.classList.add('outline-it')
    })

    // untrack the new comment and clear the outlines
    untrackNewComment(ref, { includeDescendants: true, clearOutline: true })

    // if we reached the end, reset the navigator
    if (list.length === 1) clearCommentRefs()
  }, [clearCommentRefs, untrackNewComment])

  // create the navigator object once
  if (!navigatorRef.current) {
    navigatorRef.current = { trackNewComment, untrackNewComment, scrollToComment, clearCommentRefs }
  }

  // clear the navigator on route changes
  useEffect(() => {
    router.events.on('routeChangeStart', clearCommentRefs)
    return () => router.events.off('routeChangeStart', clearCommentRefs)
  }, [clearCommentRefs, router.events])

  return { navigator: navigatorRef.current, commentCount }
}

export function CommentsNavigator ({ navigator, commentCount, className }) {
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

  return (
    <LongPressable onShortPress={scrollToComment} onLongPress={clearCommentRefs}>
      <aside
        className={`${styles.commentNavigator} fw-bold nav-link ${className}`}
        style={{ visibility: commentCount ? 'visible' : 'hidden' }}
      >
        <span aria-label='next comment' className={styles.navigatorButton}>
          <div className={styles.newCommentDot} />
        </span>
        <span className=''>{commentCount}</span>
      </aside>
    </LongPressable>
  )
}
