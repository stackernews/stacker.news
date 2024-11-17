import { useRouter } from 'next/router'
import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './pull-to-refresh.module.css'

export default function PullToRefresh ({ children }) {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPWA, setIsPWA] = useState(false)
  const touchStartY = useRef(0)
  const touchEndY = useRef(0)

  useEffect(() => {
    const checkPWA = () => {
      // android/general || ios
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    }
    setIsPWA(checkPWA())
  }, [])

  const handleTouchStart = useCallback((e) => {
    if (!isPWA || window.scrollY > 0) return // don't handle if the user is not scrolling from the top of the page
    touchStartY.current = e.touches[0].clientY
  }, [isPWA])

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === 0) return
    touchEndY.current = e.touches[0].clientY
    setPullDistance(touchEndY.current - touchStartY.current)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (touchStartY.current === 0 || touchEndY.current === 0) return
    if (touchEndY.current - touchStartY.current > 300) { // current threshold is 300, subject to change
      setIsRefreshing(true)
      router.push(router.asPath)
      setTimeout(() => {
        setIsRefreshing(false)
      }, 500) // simulate loading time
    }
    setPullDistance(0) // using this to reset the message behavior
    touchStartY.current = 0 // avoid random refreshes by resetting touch
    touchEndY.current = 0
  }, [router])

  useEffect(() => {
    if (!isPWA) return
    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isPWA, handleTouchStart, handleTouchMove, handleTouchEnd])

  const getPullMessage = () => {
    if (isRefreshing) return 'refreshing...'
    if (pullDistance > 300) return 'release to refresh'
    if (pullDistance > 0) return 'pull down to refresh'
    return ''
  }

  return (
    <div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {pullDistance > 0 || isRefreshing
          ? (
            <>
              <p className={`${styles.pullMessage} ${pullDistance > 50 || isRefreshing ? styles.fadeIn : ''}`}>
                {getPullMessage()}
              </p>
              {isRefreshing && <div className={styles.spacer} />}
            </>
            )
          : null}
        {children}
      </div>
    </div>
  )
}
