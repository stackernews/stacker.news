import { useEffect, useState } from 'react'

// observe the passed element ref and return its visibility
export default function useVisibility (elementRef, options = {}) {
  // threshold is the percentage of the element that must be visible to be considered visible
  // with pastElement, we consider the element not visible only when we're past it
  const { threshold = 0, pastElement = false } = options
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const element = elementRef.current
    if (!element || !window.IntersectionObserver || typeof window === 'undefined') return

    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        } else if (pastElement) {
          setIsVisible(entry.boundingClientRect.top > 0)
        } else {
          setIsVisible(false)
        }
      }, { threshold }
    )

    // observe the passed element ref
    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, elementRef, pastElement])

  return isVisible
}
