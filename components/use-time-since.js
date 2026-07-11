import { useEffect, useState } from 'react'
import { timeSince } from '@/lib/time'

/**
 * Returns a relative "time since" string (e.g. "5s", "3m", "2h") that refreshes
 * every second, so it stays current without relying on a parent re-render.
 */
export function useTimeSince (timestamp) {
  const [time, setTime] = useState(() => timeSince(new Date(timestamp)))

  useEffect(() => {
    // recompute immediately in case `timestamp` changed since the last tick
    setTime(timeSince(new Date(timestamp)))
    const timer = setInterval(() => {
      setTime(timeSince(new Date(timestamp)))
    }, 1000)

    return () => clearInterval(timer)
  }, [timestamp])

  return time
}
