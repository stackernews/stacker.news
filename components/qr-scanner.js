import { useEffect, useRef, useState } from 'react'

export default function QrScanner ({ loading = null, formats = ['qr_code'], onError, ...props }) {
  const [Scanner, setScanner] = useState(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    let mounted = true
    import('@yudiel/react-qr-scanner').then(mod => {
      if (mounted) setScanner(() => mod.Scanner)
    }).catch(err => {
      if (!mounted) return
      setLoadFailed(true)
      onErrorRef.current?.(err)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (!Scanner) return loadFailed ? null : loading
  return <Scanner formats={formats} onError={onError} {...props} />
}
