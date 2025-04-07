import { useRouter } from 'next/router'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import styles from './pull-to-refresh.module.css'

const REFRESH_THRESHOLD = 150

export default function PullToRefresh ({ children, className }) {
  const router = useRouter()
  const [pullDistance, setPullDistance] = useState(0)
  const [isPWA, setIsPWA] = useState(false)
  const touchStartY = useRef(0)
  const touchEndY = useRef(0)

  const checkPWA = () => {
    const androidPWA = window.matchMedia('(display-mode: standalone)').matches
    const iosPWA = window.navigator.standalone === true
    setIsPWA(androidPWA || iosPWA)
  }

  useEffect(checkPWA, [])

  const handleTouchStart = useCallback((e) => {
    // don't handle if the user is not scrolling from the top of the page, is not on a PWA or if we want Android's native PTR
    if (!isPWA || window.scrollY > 0) return
    touchStartY.current = e.touches[0].clientY
  }, [isPWA])

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === 0) return
    if (!isPWA) return
    touchEndY.current = e.touches[0].clientY
    const distance = touchEndY.current - touchStartY.current
    setPullDistance(distance)
    document.body.style.marginTop = `${Math.max(0, Math.min(distance / 2, 25))}px`
  }, [isPWA])

  const handleTouchEnd = useCallback(() => {
    if (touchStartY.current === 0 || touchEndY.current === 0) return
    if (touchEndY.current - touchStartY.current > REFRESH_THRESHOLD) {
      router.push(router.asPath)
    }
    setPullDistance(0)
    document.body.style.marginTop = '0px'
    touchStartY.current = 0
    touchEndY.current = 0
  }, [router])

  useEffect(() => {
    if (!isPWA) return
    document.body.style.overscrollBehaviorY = 'contain'
    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchmove', handleTouchMove)
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
