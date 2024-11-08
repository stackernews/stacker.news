import { useEffect } from 'react'

function useInterval (cb, ms, deps) {
  return useEffect(() => {
    const interval = setInterval(cb, ms)
    return () => clearInterval(interval)
  }, deps)
}

export default useInterval
