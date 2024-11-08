import { useEffect } from 'react'

function useInterval (cb, ms, deps) {
  return useEffect(() => {
    const interval = setInterval(() => {
      if (cb() === false) {
        clearInterval(interval)
      }
    }, ms)
    return () => clearInterval(interval)
  }, deps)
}

export default useInterval
