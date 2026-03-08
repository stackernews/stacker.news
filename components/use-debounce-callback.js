import { useCallback, useEffect, useMemo, useRef } from 'react'

export function debounce (fn, time) {
  let timeoutId

  wrapper.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return wrapper

  function wrapper (...args) {
    wrapper.cancel()
    timeoutId = setTimeout(() => {
      timeoutId = null
      fn(...args)
    }, time)
    // return a function that clears the timeout for use in useEffect cleanup
    return () => wrapper.cancel()
  }
}

const DEFAULT_DEPS = []

export default function useDebounceCallback (fn, time, deps = DEFAULT_DEPS) {
  const memoFn = useCallback(fn, deps)
  const fnRef = useRef(memoFn)
  const timeRef = useRef(time)
  const timeoutRef = useRef(null)

  fnRef.current = memoFn
  timeRef.current = time

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const debounced = useCallback((...args) => {
    cancel()
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      fnRef.current(...args)
    }, timeRef.current)
    return cancel
  }, [cancel])

  useEffect(() => cancel(), [memoFn, time, cancel])
  useEffect(() => () => cancel(), [cancel])

  return useMemo(() => Object.assign(debounced, { cancel }), [debounced, cancel])
}
