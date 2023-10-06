import { useCallback, useEffect, useState } from 'react'

export function debounce (fn, time) {
  let timeoutId
  return wrapper
  function wrapper (...args) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      timeoutId = null
      fn(...args)
    }, time)
    // return a function that clears the timeout for use in useEffect cleanup
    return () => clearTimeout(timeoutId)
  }
}

export default function useDebounceCallback (fn, time, deps = []) {
  const [args, setArgs] = useState([])
  useEffect(debounce(() => fn(...args), time), [fn, time, args, ...deps])
  return useCallback((...args) => setArgs(args), [])
}
