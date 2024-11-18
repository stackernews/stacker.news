import { useRouter } from 'next/router'
import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './pull-to-refresh.module.css'

const REFRESH_THRESHOLD = 300

export default function PullToRefresh ({ children, android }) {
  const router = useRouter()
  const [pullDistance, setPullDistance] = useState(0)
  const [isPWA, setIsPWA] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const touchStartY = useRef(0)
  const touchEndY = useRef(0)

  const checkPWA = () => {
    const androidPWA = window.matchMedia('(display-mode: standalone)').matches
    const iosPWA = window.navigator.standalone === true
    setIsAndroid(androidPWA) // we need to know if the user is on Android to enable toggling its native PTR
    setIsPWA(androidPWA || iosPWA)
  }

  useEffect(checkPWA, [])

  const handleTouchStart = useCallback((e) => {
    // don't handle if the user is not scrolling from the top of the page, is not on a PWA or if we want Android's native PTR
    if (!isPWA || (isAndroid && !android) || window.scrollY > 0) return
    touchStartY.current = e.touches[0].clientY
  }, [isPWA, isAndroid, android])

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === 0) return // prevent unintended refresh by checking if the user has actually started touching
    touchEndY.current = e.touches[0].clientY
    setPullDistance(touchEndY.current - touchStartY.current)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (touchStartY.current === 0 || touchEndY.current === 0) return // if the user has started touch or is actually 'pulling'
    if (touchEndY.current - touchStartY.current > REFRESH_THRESHOLD) {
      router.push(router.asPath) // reload the same path
    }
    setPullDistance(0) // using this to reset the message behavior
    touchStartY.current = 0 // avoid random refreshes by resetting touch
    touchEndY.current = 0
  }, [router])

  useEffect(() => {
    // don't handle if the user is not on a PWA or if we want Android's native PTR
    if (!isPWA || (isAndroid && !android)) return
    document.body.style.overscrollBehaviorY = 'contain' // disable Android's native PTR
    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
    return () => {
      document.body.style.overscrollBehaviorY = '' // if unmounted reset the overscroll behavior
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isPWA, isAndroid, android, handleTouchStart, handleTouchMove, handleTouchEnd])

  const getPullMessage = () => {
    if (pullDistance > REFRESH_THRESHOLD) return 'release to refresh'
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
        <p className={`${styles.pullMessage} ${pullDistance > 50 && styles.fadeIn}`}>
          {getPullMessage()}
        </p>
        {children}
      </div>
    </div>
  )
}
