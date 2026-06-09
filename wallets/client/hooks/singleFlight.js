import { useCallback, useRef, useState } from 'react'

/**
 * Hook that wraps an async function to prevent multiple concurrent executions.
 * Uses a ref for synchronous guarding (blocks immediately) and state for UI updates.
 *
 * @param {Function} fn - async function to wrap
 * @returns {[Function, boolean]} - [wrappedFn, inFlight]
 */
export function useSingleFlight (fn) {
  const inFlightRef = useRef(false)
  const [inFlight, setInFlight] = useState(false)

  const wrapped = useCallback(async (...args) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setInFlight(true)
    try {
      return await fn(...args)
    } finally {
      inFlightRef.current = false
      setInFlight(false)
    }
  }, [fn])

  return [wrapped, inFlight]
}
