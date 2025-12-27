import { useEffect, useRef, useState } from 'react'

export function useScrollThreshold (offset = 0) {
  const [past, setPast] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return

    const observer = new window.IntersectionObserver(([entry]) => {
      setPast(!entry.isIntersecting)
    }, { root: null, rootMargin: `${offset}px 0px 0px 0px`, threshold: 0 })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [offset])

  return { sentinelRef: ref, past }
}
