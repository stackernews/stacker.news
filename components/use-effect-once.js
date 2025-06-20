import { useEffect, useRef } from 'react'

// This hook is like useEffect, except that it does not run twice because of React Strict Mode.
// https://react.dev/reference/react/StrictMode

export default function useEffectOnce (func, deps) {
  const didMount = useRef(false)

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return func()
    }
  }, deps)
}
