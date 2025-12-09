import { useRouter } from 'next/router'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import styles from './pull-to-refresh.module.css'
import NProgress from 'nprogress'

const REFRESH_THRESHOLD = 150
const PULL_TIMEOUT = 1500

export default function PullToRefresh ({ children, className }) {
  const router = useRouter()
  const [pullDistance, setPullDistance] = useState(0)
  const [isPWA, setIsPWA] = useState(false)
  const touchStartY = useRef(0)
  const touchEndY = useRef(0)
  const pullTimeoutRef = useRef(null)

  const checkPWA = () => {
    const androidPWA = window.matchMedia('(display-mode: standalone)').matches
    const iosPWA = window.navigator.standalone === true
    setIsPWA(androidPWA || iosPWA)
  }

  const clearPullDistance = () => {
    setPullDistance(0)
    document.body.style.marginTop = '0px'
    touchStartY.current = 0
    touchEndY.current = 0
    if (pullTimeoutRef.current) {
      clearTimeout(pullTimeoutRef.current)
      pullTimeoutRef.current = null
    }
  }

  useEffect(checkPWA, [])

  const handleTouchStart = useCallback((e) => {
    // don't handle if the user is not scrolling from the top of the page, is not on a PWA or if we want Android's native PTR
    if (!isPWA || window.scrollY > 0) return
    touchStartY.current = e.touches[0].clientY
    pullTimeoutRef.current = setTimeout(() => {
      clearPullDistance()
    }, PULL_TIMEOUT)
  }, [isPWA])

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === 0) return
    if (!isPWA) return

    // if we're not at the top of the page after the touch start, reset the pull distance
    if (window.scrollY > 0) {
      clearPullDistance()
      return
    }
    touchEndY.current = e.touches[0].clientY
    const distance = touchEndY.current - touchStartY.current
    if (distance > 0) {
      e.preventDefault()
      setPullDistance(distance)
      document.body.style.marginTop = `${Math.max(0, Math.min(distance / 2, 25))}px`
    } else {
      clearPullDistance()
    }
  }, [isPWA])

  const handleTouchEnd = useCallback(() => {
    if (touchStartY.current === 0 || touchEndY.current === 0) return
    if (touchEndY.current - touchStartY.current > REFRESH_THRESHOLD) {
      NProgress.done()
      router.replace(router.asPath)
    }
    clearPullDistance()
  }, [router])

  useEffect(() => {
    if (!isPWA) return
    document.body.style.overscrollBehaviorY = 'contain'
    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
    return () => {
      document.body.style.overscrollBehaviorY = ''
      document.body.style.marginTop = '0px'
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isPWA, handleTouchStart, handleTouchMove, handleTouchEnd])

  const pullMessage = useMemo(() => {
    if (pullDistance > REFRESH_THRESHOLD) return 'release to refresh'
    return 'pull down to refresh'
  }, [pullDistance])

  return (
    <main
      className={className}
    >
      <p
        className={`${styles.pullMessage}`}
        style={{ opacity: pullDistance > 0 ? 1 : 0, top: `${Math.max(-20, Math.min(-20 + pullDistance / 2, 5))}px` }}
      >
        {pullMessage}
      </p>
      {children}
    </main>
  )
}
