import { useEffect, useRef, useState } from 'react'

export function useScrollThreshold (threshold = 0) {
  const [past, setPast] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return

    if (typeof IntersectionObserver === 'undefined') {
      const onScroll = () => setPast(window.scrollY > threshold)
      onScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }

    const observer = new window.IntersectionObserver(([entry]) => {
      setPast(!entry.isIntersecting)
    }, { root: null, rootMargin: `${threshold}px 0px 0px 0px`, threshold: 0 })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])

  return { sentinelRef: ref, past }
}
