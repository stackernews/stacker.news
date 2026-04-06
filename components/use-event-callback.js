import { useCallback, useRef } from 'react'

export function useEventCallback (fn) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  return useCallback((...args) => fnRef.current(...args), [])
}
