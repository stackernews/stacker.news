import { useCallback } from 'react'

export function useEncryption () {
  // TODO(wallet-v2): implement this
}

export function useDecryption () {
  return useCallback(({ iv, value }) => {
    // TODO(wallet-v2): decrypt value
    return `${iv}$${value}`
  }, [])
}
