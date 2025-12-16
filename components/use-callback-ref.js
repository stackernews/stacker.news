import { useState, useCallback } from 'react'

/**
 * a hook that returns a ref and a callback to set the ref.
 *
 * especially useful for refs that may not be available immediately
 *
 * an example can be the Lexical Reader that is dynamically loaded, its ref is not available immediately.
 */
export default function useCallbackRef (initialRef = null) {
  const [ref, setRef] = useState(initialRef)

  const onRef = useCallback((_ref) => {
    if (_ref !== null) {
      setRef(_ref)
    }
  }, [])

  return { ref, onRef }
}
