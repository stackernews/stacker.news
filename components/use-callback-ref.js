import { useState, useCallback } from 'react'

/**
 * a hook that returns a ref and a callback to set the ref.
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
