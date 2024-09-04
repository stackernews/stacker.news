import { useEffect, useState } from 'react'

// https://usehooks-ts.com/react-hook/use-is-client#hook
export function useIsClient () {
  const [isClient, setClient] = useState(false)

  useEffect(() => {
    setClient(true)
  }, [])

  return isClient
}
