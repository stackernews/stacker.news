import { useEffect, useRef } from 'react'

export default function useNoInitialEffect (func, deps) {
  const didMount = useRef(false)

  useEffect(() => {
    if (didMount.current) {
      return func()
    } else {
      didMount.current = true
    }
  }, deps)
}
