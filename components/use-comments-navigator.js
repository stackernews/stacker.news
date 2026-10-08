import { useCallback, useEffect, useRef, useState, startTransition, createContext, useContext } from 'react'
import styles from './comment.module.css'
import { navLinkClasses } from '@/components/ui/nav'
import LongPressable from './long-pressable'
import { useFavicon } from './favicon'
import { cn } from '@/lib/cn'

const emptyNavigator = {
  navigator: {
    trackNewComment: () => {},
    untrackNewComment: () => {},
    scrollToComment: () => {},
    clearCommentRefs: () => {}
  },
  commentCount: 0
}
const CommentsNavigatorContext = createContext(null)

export function CommentsNavigatorProvider ({ children }) {
  const value = useCommentsNavigator()

  return (
    <CommentsNavigatorContext.Provider value={value}>
      {children}
    </CommentsNavigatorContext.Provider>
  )
}

export function useCommentsNavigatorContext () {
  return useContext(CommentsNavigatorContext) || emptyNavigator
}

export function useCommentsNavigator () {
  const { setHasNewComments } = useFavicon()
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
      // filter out disconnected refs before counting
      commentRefs.current = commentRefs.current.filter(item =>
        item.ref?.current?.isConnected
      )
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
    setHasNewComments(false)
  }, [])

  // track a new comment, returns true if the ref was actually inserted
  const trackNewComment = useCallback((commentRef, createdAt) => {
    const node = commentRef?.current
    if (!node || !node.isConnected) return false

    // dedupe
    const existing = commentRefs.current.some(item => item.ref.current === node)
    if (existing) return false

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

    setHasNewComments(true)
    throttleCountUpdate()
    return true
  }, [throttleCountUpdate, setHasNewComments])

  // remove a comment ref from the list
  const untrackNewComment = useCallback((commentRef, options = {}) => {
    // we just need to read a single comment to clear the favicon
    setHasNewComments(false)

    const { includeDescendants = false, clearOutline = false } = options

    const refNode = commentRef.current
    if (!refNode) {
      // update the comment count, the ref may be disconnected
      throttleCountUpdate()
      return
    }

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
          'outline-new-live-comment'
        )
        node.classList.add('outline-new-comment-unset')
      }
    }

    if (toRemove.length) {
      commentRefs.current = commentRefs.current.filter(item => !toRemove.includes(item))
    }
    throttleCountUpdate()
  }, [throttleCountUpdate])

  // scroll to the next new comment
  const scrollToComment = useCallback(() => {
    const list = commentRefs.current
    if (!list.length) return

    const ref = list[0]?.ref
    const node = ref?.current
    if (!node) {
      // update the comment count, the ref may be disconnected
      throttleCountUpdate()
      return
    }

    // smoothly scroll to the start of the comment
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })

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
  }, [clearCommentRefs, untrackNewComment, throttleCountUpdate])

  // create the navigator object once
  if (!navigatorRef.current) {
    navigatorRef.current = { trackNewComment, untrackNewComment, scrollToComment, clearCommentRefs }
  }

  // clear the navigator on unmount
  useEffect(() => {
    return () => clearCommentRefs()
  }, [clearCommentRefs])

  return { navigator: navigatorRef.current, commentCount }
}

export function CommentsNavigator () {
  const context = useContext(CommentsNavigatorContext)
  const { navigator, commentCount } = context || emptyNavigator
  const { scrollToComment, clearCommentRefs } = navigator
  const hasNew = commentCount > 0

  useEffect(() => {
    if (!hasNew) return

    const onNext = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return
      if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        scrollToComment()
      }
      if (e.key === 'Escape') clearCommentRefs()
    }

    document.addEventListener('keydown', onNext)
    return () => document.removeEventListener('keydown', onNext)
  }, [hasNew, scrollToComment, clearCommentRefs])

  if (!context) return null

  return (
    <div className={cn('w-14 shrink-0', !commentCount && 'invisible')}>
      <LongPressable onShortPress={scrollToComment} onLongPress={clearCommentRefs}>
        <button
          type='button'
          disabled={!commentCount}
          aria-label={`next comment (${commentCount} unread)`}
          title={`${commentCount} unread comments`}
          onClick={e => { if (e.detail === 0) scrollToComment() }}
          className={navLinkClasses({ className: `${styles.commentNavigator} w-full px-1 font-bold` })}
        >
          <span className={`${styles.newCommentDot} shrink-0`} />
          <span aria-hidden>{commentCount > 99 ? '99+' : commentCount}</span>
        </button>
      </LongPressable>
    </div>
  )
}
