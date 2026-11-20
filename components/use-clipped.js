import { useEffect, useState } from 'react'

// returns true if the content of the node is taller than the node
export default function useClipped (containerRef) {
  const [clipped, setClipped] = useState(false)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    // 1px added for sub-pixel rounding
    function checkClipped () {
      setClipped(node.scrollHeight > node.clientHeight + 1)
    }

    let resizeObserver
    if ('ResizeObserver' in window) {
      resizeObserver = new window.ResizeObserver(checkClipped)
      resizeObserver.observe(node)
    }

    // when media is loaded from autolinks, scrollHeight changes but box size may not
    // which ResizeObserver doesn't detect, so we need to capture load events from media
    // and recheck when media loads.
    function handleMediaLoad (e) {
      if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
        checkClipped()
      }
    }
    node.addEventListener('load', handleMediaLoad, true)

    window.addEventListener('resize', checkClipped)
    checkClipped()
    return () => {
      window.removeEventListener('resize', checkClipped)
      node.removeEventListener('load', handleMediaLoad, true)
      resizeObserver?.disconnect()
    }
  }, [containerRef])

  return clipped
}
